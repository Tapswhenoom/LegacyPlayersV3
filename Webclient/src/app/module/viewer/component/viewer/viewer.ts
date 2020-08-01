import {Component} from "@angular/core";
import {InstanceDataService} from "../../service/instance_data";
import {ActivatedRoute} from "@angular/router";
import {UnitService} from "../../service/unit";
import {ViewerMode} from "../../domain_value/viewer_mode";
import {SpellService} from "../../service/spell";

@Component({
    selector: "Viewer",
    templateUrl: "./viewer.html",
    styleUrls: ["./viewer.scss"],
    providers: [
        InstanceDataService,
        UnitService,
        SpellService
    ]
})
export class ViewerComponent {

    private instance_meta_id: number;
    private current_mode: ViewerMode = ViewerMode.Base;

    constructor(
        private instanceDataService: InstanceDataService,
        private activatedRouteService: ActivatedRoute
    ) {
        this.activatedRouteService.paramMap.subscribe(params => {
            this.instance_meta_id = Number(params.get('instance_meta_id'));
            this.instanceDataService.instance_meta_id = this.instance_meta_id;

            const route_mode = params.get("mode") as ViewerMode;
            if ([ViewerMode.Base, ViewerMode.Ability, ViewerMode.Detail].includes(route_mode))
                this.current_mode = route_mode;
        });
    }

    is_base_mode(): boolean {
        return this.current_mode === ViewerMode.Base;
    }

    is_detail_mode(): boolean {
        return this.current_mode === ViewerMode.Detail;
    }

}
