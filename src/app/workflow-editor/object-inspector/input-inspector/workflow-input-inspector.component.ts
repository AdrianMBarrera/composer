import {Component, Input, Output, ViewEncapsulation} from "@angular/core";
import {WorkflowInputParameterModel} from "cwlts/models";
import {Subject} from "rxjs";

@Component({
    encapsulation: ViewEncapsulation.None,

    selector: "ct-workflow-input-inspector",
    template: `
        <div>
            <!--REMOVE ME-->
            <pre>{{ input | json }}</pre>
        </div>`
})
export class WorkflowInputInspector {
    @Input()
    public input: WorkflowInputParameterModel;

    @Output()
    public save = new Subject<WorkflowInputParameterModel>();
}