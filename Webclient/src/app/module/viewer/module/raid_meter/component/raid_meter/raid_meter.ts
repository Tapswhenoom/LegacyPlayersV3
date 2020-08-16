import {Component, Input, OnDestroy, OnInit} from "@angular/core";
import {DamageDoneService} from "../../service/damage_done";
import {UtilService} from "../../service/util";
import {SelectOption} from "../../../../../../template/input/select_input/domain_value/select_option";
import {Subscription} from "rxjs";
import {InstanceDataService} from "../../../../service/instance_data";
import {SettingsService} from "src/app/service/settings";
import {ActivatedRoute, Router} from "@angular/router";
import {ViewerMode} from "../../../../domain_value/viewer_mode";
import {InstanceViewerMeta} from "../../../../domain_value/instance_viewer_meta";
import {RaidConfigurationSelectionService} from "../../../raid_configuration_menu/service/raid_configuration_selection";
import {RaidMeterSubject} from "../../../../../../template/meter_graph/domain_value/raid_meter_subject";
import {RaidMeterService} from "../../service/raid_meter";
import {RaidDetailService} from "../../../raid_detail_table/service/raid_detail";
import {HitType} from "../../../../domain_value/hit_type";
import {DetailRow} from "../../../raid_detail_table/domain_value/detail_row";
import {DelayedLabel} from "../../../../../../stdlib/delayed_label";
import {DamageTakenService} from "../../service/damage_taken";
import {DamageDoneDetailService} from "../../../raid_detail_table/service/damage_done_detail";
import {DamageTakenDetailService} from "../../../raid_detail_table/service/damage_taken_detail";
import {HealDoneService} from "../../service/heal_done";
import {HealTakenService} from "../../service/heal_taken";
import {HealDoneDetailService} from "../../../raid_detail_table/service/heal_done_detail";
import {HealTakenDetailService} from "../../../raid_detail_table/service/heal_taken_detail";
import {ThreatDoneService} from "../../service/threat_done";
import {ThreatDoneDetailService} from "../../../raid_detail_table/service/threat_done_detail";
import {DeathService} from "../../service/death";
import {DeathOverviewRow} from "../../module/deaths_overview/domain_value/death_overview_row";
import {KillService} from "../../service/kill";

@Component({
    selector: "RaidMeter",
    templateUrl: "./raid_meter.html",
    styleUrls: ["./raid_meter.scss"],
    providers: [
        UtilService,
        DamageDoneService,
        DamageTakenService,
        HealDoneService,
        HealTakenService,
        ThreatDoneService,
        DeathService,
        KillService,
        RaidMeterService,
        // Raid Detail Service
        DamageDoneDetailService,
        DamageTakenDetailService,
        HealDoneDetailService,
        HealTakenDetailService,
        ThreatDoneDetailService,
        RaidDetailService,
    ]
})
export class RaidMeterComponent implements OnDestroy, OnInit {

    current_meta: InstanceViewerMeta;

    @Input() unique_id: string;

    private subscription: Subscription;
    private subscription_total_duration: Subscription;
    private subscription_activated_route: Subscription;
    private subscription_meta: Subscription;
    private subscription_abilities: Subscription;
    private subscription_units: Subscription;
    private subscription_ability_details: Subscription;

    private cookie_id: string;
    private current_data: Array<[number, Array<[number, number] | DeathOverviewRow>]> = [];
    private ability_details: Array<[number, Array<[HitType, DetailRow]>]> = [];
    private abilities: Map<number, RaidMeterSubject> = new Map();
    private units: Map<number, RaidMeterSubject> = new Map();
    bar_tooltips: Map<number, any> = new Map();


    in_ability_mode: boolean = false;

    current_attempt_duration: number = 1;
    bars: Array<[number, number] | DeathOverviewRow> = [];

    current_selection: number = 1;
    options: Array<SelectOption> = [
        {value: 1, label_key: 'Damage done'},
        {value: 2, label_key: 'Damage taken'},
        {value: 3, label_key: 'Total healing done'},
        {value: 4, label_key: 'Total healing taken'},
        {value: 5, label_key: 'Effective healing done'},
        {value: 6, label_key: 'Effective healing taken'},
        {value: 7, label_key: 'Overhealing done'},
        {value: 8, label_key: 'Overhealing taken'},
        {value: 9, label_key: 'Threat done'},
        {value: 10, label_key: 'Deaths'},
        {value: 11, label_key: 'Kills'},
        {value: 99, label_key: 'Event Log'},
    ];

    constructor(
        private activatedRouteService: ActivatedRoute,
        private routerService: Router,
        private settingsService: SettingsService,
        private instanceDataService: InstanceDataService,
        private raidConfigurationSelectionService: RaidConfigurationSelectionService,
        private raidMeterService: RaidMeterService,
        private raidDetailService: RaidDetailService
    ) {
        this.subscription_activated_route = this.activatedRouteService.paramMap.subscribe(params => {
            const new_mode = params.get("mode") === ViewerMode.Ability;
            if (this.in_ability_mode !== new_mode) {
                this.in_ability_mode = new_mode;
                this.update_bars(this.current_data);
                this.selection_changed(this.current_selection);
            }
        });
        this.subscription_total_duration = this.instanceDataService.attempt_total_duration.subscribe(duration => this.current_attempt_duration = duration / 1000);
        this.subscription_meta = this.instanceDataService.meta.subscribe(meta => this.current_meta = meta);
        this.subscription_abilities = this.raidMeterService.abilities.subscribe(abilities => this.abilities = abilities);
        this.subscription_units = this.raidMeterService.units.subscribe(units => this.units = units);
        this.subscription = this.raidMeterService.data.subscribe(rows => this.update_bars(rows));
        this.subscription_ability_details = this.raidDetailService.ability_details.subscribe(details => {
            this.ability_details = details;
            this.update_bars(this.current_data);
        });
    }

    ngOnInit(): void {
        this.cookie_id = "raid_meter_" + this.unique_id;

        if (this.settingsService.check(this.cookie_id)) {
            this.current_selection = this.settingsService.get(this.cookie_id);
        }
        this.selection_changed(this.current_selection);
    }

    ngOnDestroy(): void {
        this.subscription?.unsubscribe();
        this.subscription_total_duration?.unsubscribe();
        this.subscription_activated_route?.unsubscribe();
        this.subscription_meta?.unsubscribe();
        this.subscription_abilities?.unsubscribe();
        this.subscription_units?.unsubscribe();
        this.subscription_ability_details?.unsubscribe();
    }

    get bar_subjects(): Map<number, RaidMeterSubject> {
        if (this.in_ability_mode)
            return this.abilities;
        return this.units;
    }

    get total(): number {
        if ([10, 11].includes(this.current_selection) && this.in_ability_mode)
            return this.bars.length;
        return this.bars.reduce((acc, bar) => acc + bar[1], 0);
    }

    get total_ps(): number {
        return this.total / this.current_attempt_duration;
    }

    selection_changed(selection: number): void {
        if (selection === 99) {
            this.routerService.navigate(["/viewer/" + this.current_meta?.instance_meta_id + "/event_log/by_actor"]);
            return;
        }

        this.raidMeterService.select(selection);
        this.raidDetailService.select(selection);

        if (!!this.unique_id)
            this.settingsService.set(this.cookie_id, selection);
    }

    bar_clicked(bar: [number, number]): void {
        if (!this.in_ability_mode)
            this.raidConfigurationSelectionService.select_sources([bar[0]]);
        this.routerService.navigate(['/viewer/' + this.current_meta?.instance_meta_id + '/' + this.get_router_link(bar)]);
    }

    private get_bar_tooltip(subject_id: number): any {
        if (!this.in_ability_mode) {
            // TODO: Refactor condition
            if ([10, 11].includes(this.current_selection)) {
                return {
                    type: 7,
                    payload: this.current_data.find(entry => entry[0] === subject_id)[1].slice(0, 10),
                    server_id: this.current_meta.server_id
                };
            } else {
                return {
                    type: 5,
                    payload: this.ability_rows((this.current_data as Array<[number, Array<[number, number]>]>).filter(([unit_id, abilities]) => unit_id === subject_id))
                        .sort((left, right) => right[1] - left[1])
                        .map(([ability_id, amount]) => [this.abilities.get(ability_id).name, amount])
                };
            }
        }
        const payload = this.ability_details.find(([i_ability_id, i_details]) => i_ability_id === subject_id);
        return {
            type: 6,
            payload: !payload ? undefined : payload[1],
            icon: new DelayedLabel(this.abilities.get(subject_id).icon)
        };
    }

    private get_router_link(bar: [number, number]): string {
        if (this.in_ability_mode)
            return 'detail/' + this.current_selection.toString() + '/' + bar[0].toString();
        return 'ability';
    }

    private ability_rows(data: Array<[number, Array<[number, number]>]>): Array<[number, number]> {
        return [...data.reduce((acc, [unit_id, abilities]) => {
            const ability_amount = acc;
            for (const [ability_id, amount] of abilities) {
                if (ability_amount.has(ability_id)) ability_amount.set(ability_id, ability_amount.get(ability_id) + amount);
                else ability_amount.set(ability_id, amount);
            }
            return ability_amount;
        }, new Map())];
    }

    private update_bars(rows: Array<[number, Array<[number, number] | DeathOverviewRow>]>): void {
        // Bars
        this.current_data = rows;
        let result;
        if (this.in_ability_mode) {
            if ([10, 11].includes(this.current_selection)) result = rows.reduce((acc, [unit_id, secondary]) => [...acc, ...secondary], []);
            else result = this.ability_rows(rows as Array<[number, Array<[number, number]>]>);
        } else {
            if ([10, 11].includes(this.current_selection)) {
                result = rows.map(([unit_id, secondary]) => [unit_id, secondary.length]);
            } else {
                result = (rows as Array<[number, Array<[number, number]>]>).map(([unit_id, abilities]) =>
                    [unit_id, abilities.reduce((acc, [ability_id, amount]) => acc + amount, 0)])
                    .filter(([unit_id, row_amount]) => row_amount !== 0);
            }
        }

        // Bar tooltips
        if (![10, 11].includes(this.current_selection) || !this.in_ability_mode) {
            for (const [subject_id, amount] of result)
                this.bar_tooltips.set(subject_id, this.get_bar_tooltip(subject_id));
        }

        if ([10, 11].includes(this.current_selection))
            this.bars = result.sort((left, right) => right.timestamp - left.timestamp);
        else this.bars = result.sort((left, right) => right[1] - left[1]);
    }

    get show_per_second(): boolean {
        return ![10, 11].includes(this.current_selection);
    }

}
