import {AfterViewInit, ChangeDetectorRef, Component, Injector, OnDestroy, OnInit, ViewChild} from "@angular/core";
import {WorkflowFactory, WorkflowModel} from "cwlts/models";
import * as Yaml from "js-yaml";
import {AppMetaManagerToken, appMetaManagerFactory} from "../core/app-meta/app-meta-manager-factory";
import {CodeSwapService} from "../core/code-content-service/code-content.service";
import {DataGatewayService} from "../core/data-gateway/data-gateway.service";
import {APP_MODEL, appModelFactory} from "../core/factories/app-model-provider-factory";
import {WorkboxService} from "../core/workbox/workbox.service";
import {AppEditorBase} from "../editor-common/app-editor-base/app-editor-base";
import {AppValidatorService} from "../editor-common/app-validator/app-validator.service";
import {PlatformAppService} from "../editor-common/components/platform-app-common/platform-app.service";
import {EditorInspectorService} from "../editor-common/inspector/editor-inspector.service";
import {APP_SAVER_TOKEN} from "../editor-common/services/app-saving/app-saver.interface";
import {LocalFileSavingService} from "../editor-common/services/app-saving/local-file-saving.service";
import {PlatformAppSavingService} from "../editor-common/services/app-saving/platform-app-saving.service";
import {ExecutorService} from "../executor-service/executor.service";
import {NotificationBarService} from "../layout/notification-bar/notification-bar.service";
import {StatusBarService} from "../layout/status-bar/status-bar.service";
import {LocalRepositoryService} from "../repository/local-repository.service";
import {PlatformRepositoryService} from "../repository/platform-repository.service";
import {IpcService} from "../services/ipc.service";
import {ModalService} from "../ui/modal/modal.service";
import {WorkflowGraphEditorComponent} from "./graph-editor/graph-editor/workflow-graph-editor.component";
import {WorkflowEditorService} from "./workflow-editor.service";
import {FileRepositoryService} from "../file-repository/file-repository.service";
import {ExportAppService} from "../services/export-app/export-app.service";
import {HintsModalComponent} from "../core/modals/hints-modal/hints-modal.component";
import {Store} from "@ngrx/store";
import {AuthService} from "../auth/auth.service";

export function appSaverFactory(comp: WorkflowEditorComponent, ipc: IpcService, modal: ModalService, platformRepository: PlatformRepositoryService) {

    if (comp.tabData.dataSource === "local") {
        return new LocalFileSavingService(ipc);
    }

    return new PlatformAppSavingService(platformRepository, modal);
}

@Component({
    selector: "ct-workflow-editor",
    providers: [EditorInspectorService, NotificationBarService, WorkflowEditorService, CodeSwapService, PlatformAppService,
        {
            provide: APP_SAVER_TOKEN,
            useFactory: appSaverFactory,
            deps: [WorkflowEditorComponent, IpcService, ModalService, PlatformRepositoryService]
        }, {
            provide: AppMetaManagerToken,
            useFactory: appMetaManagerFactory,
            deps: [WorkflowEditorComponent, LocalRepositoryService, PlatformRepositoryService]
        },
        {
            provide: APP_MODEL,
            useFactory: appModelFactory,
            deps: [WorkflowEditorComponent]
        }

    ],
    styleUrls: ["../editor-common/app-editor-base/app-editor-base.scss"],
    templateUrl: "./workflow-editor.component.html"
})
export class WorkflowEditorComponent extends AppEditorBase implements OnDestroy, OnInit, AfterViewInit {

    inspectorService: EditorInspectorService;

    constructor(statusBar: StatusBarService,
                notificationBar: NotificationBarService,
                modal: ModalService,
                inspector: EditorInspectorService,
                dataGateway: DataGatewayService,
                injector: Injector,
                appValidator: AppValidatorService,
                codeSwapService: CodeSwapService,
                protected platformRepository: PlatformRepositoryService,
                protected cdr: ChangeDetectorRef,
                platformAppService: PlatformAppService,
                localRepository: LocalRepositoryService,
                fileRepository: FileRepositoryService,
                workbox: WorkboxService,
                exportApp: ExportAppService,
                store: Store<any>,
                auth: AuthService,
                executorService: ExecutorService) {
        super(
            statusBar,
            notificationBar,
            modal,
            inspector,
            dataGateway,
            injector,
            appValidator,
            codeSwapService,
            platformAppService,
            platformRepository,
            localRepository,
            fileRepository,
            workbox,
            exportApp,
            store,
            auth,
            executorService
        );

        this.inspectorService = inspector;
    }

    protected getPreferredTab(): string {
        return "graph";
    }

    protected recreateModel(json: Object): void {
        this.dataModel = WorkflowFactory.from(json as any, "document");

        if (!this.dataModel.namespaces.has("sbg")) {
            this.dataModel.namespaces.set("sbg", "https://www.sevenbridges.com");
        }

        this.dataModel.setValidationCallback(this.afterModelValidation.bind(this));
        this.dataModel.validate().then(this.afterModelValidation.bind(this));
    }


    /** Default view mode. */
    viewMode: "info" | "graph" | "code" | "test" | string;

    /** Model that's recreated on document change */
    dataModel: WorkflowModel;

    @ViewChild(WorkflowGraphEditorComponent)
    graphEditor: WorkflowGraphEditorComponent;

    private hasPendingRedraw = false;

    private graphDrawQueue: Function[] = [];

    protected toggleLock(locked: boolean): void {
        super.toggleLock(locked);

        if (this.graphEditor) {
            this.graphEditor.setGraphManipulationsLock(locked);
        } else {
            this.graphDrawQueue.push(() => {
                this.graphEditor.setGraphManipulationsLock(locked);
            });
        }
    }

    /**
     * Serializes model to text. It also adds sbg:modified flag to indicate
     * the text has been formatted by the GUI editor
     */
    protected getModelText(embed = false): string {
        const wf = embed || this.tabData.dataSource === "app" ? this.dataModel.serializeEmbedded() : this.dataModel.serialize();

        return this.tabData.language === "json" || this.tabData.dataSource === "app" ?
            JSON.stringify(wf, null, 4) : Yaml.dump(wf);
    }

    onTabActivation(): void {
        if (this.graphEditor) {
            this.graphEditor.checkOutstandingGraphFitting();

            if (this.hasPendingRedraw) {
                this.hasPendingRedraw = !this.graphEditor.redrawIfCanDrawInWorkflow();
            }
        }
    }

    onGraphDraw(component: WorkflowGraphEditorComponent) {
        this.graphEditor = component;

        while (this.graphDrawQueue.length) {
            this.graphDrawQueue.shift()();
        }
    }

    setHints() {
        const hints = this.modal.fromComponent(HintsModalComponent, {
            title: "Set Hints",
            backdrop: true,
            closeOnEscape: true
        });

        hints.model = this.dataModel;
        hints.readonly = this.isReadonly;
    }
}
