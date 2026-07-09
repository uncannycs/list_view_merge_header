import { patch } from "@web/core/utils/patch";
import { ListRenderer } from "@web/views/list/list_renderer";
import { HeaderEditor } from "../header_editor/header_editor";
import { useState, onMounted, onPatched, onWillStart, onWillRender } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { registerTemplateProcessor } from "@web/core/templates";

const parser = new DOMParser();
const newTheadXmlString = `
<thead t-att-class="{ 'o_list_merge_center_text': headerConfigState.centerHeaders }">
    <!-- Row 1 -->
    <tr>
        <th t-if="hasSelectors" rowspan="2" class="o_list_record_selector o_list_controller align-middle pe-1 cursor-pointer" tabindex="-1" t-on-keydown="(ev) => this.onCellKeydown(ev)" t-on-click.stop="toggleSelection" data-merge-column-id="selector">
            <CheckBox disabled="!_canSelectRecord" value="selectAll" className="'d-flex m-0'" onChange.bind="toggleSelection"/>
        </th>
        <t t-if="hasGroupedHeaders()">
            <t t-foreach="getRow1Cells()" t-as="cell" t-key="cell.id">
                <th t-if="cell.isGroup"
                    t-att-colspan="cell.colspan"
                    t-att-class="'o_list_merge_group_header align-middle text-center' + (cell.center ? ' o_list_merge_center' : '')">
                    <div class="d-flex align-items-center justify-content-center">
                        <span class="d-block min-w-0 text-truncate" t-esc="cell.label"/>
                    </div>
                </th>
                <th t-else=""
                    t-att-rowspan="2"
                    t-att-data-name="cell.column.name"
                    t-att-class="getColumnClass(cell.column) + ' opacity-trigger-hover w-print-auto align-middle'"
                    t-on-pointerup="onColumnTitleMouseUp"
                    t-on-click="() => this.onClickSortColumn(cell.column)"
                    t-on-keydown="(ev) => this.onCellKeydown(ev)"
                    data-tooltip-delay="1000"
                    t-att-data-merge-column-id="cell.column.id"
                    tabindex="-1">
                    <t t-if="cell.column.hasLabel and cell.column.widget !== 'handle'">
                        <t t-set="isNumeric" t-value="isNumericColumn(cell.column)"/>
                        <div class="d-flex align-items-center"
                             t-att-data-tooltip-template="isDebugMode ? 'web.FieldTooltip' : 'web.ListHeaderTooltip'"
                             t-att-data-tooltip-info="makeTooltip(cell.column)">
                            <span class="d-block min-w-0 text-truncate flex-grow-1 flex-shrink-1" t-att-class="isNumeric ? 'o_list_number_th' : ''" t-esc="cell.column.label"/>
                            <div class="o_list_header_label_spacer"/>
                            <i class="o_list_sortable_icon" t-att-class="getSortableIconClass(cell.column)"/>
                        </div>
                        <span class="o_resize position-absolute top-0 end-0 bottom-0 ps-1 bg-black-25 opacity-0 opacity-50-hover z-1"
                              t-on-pointerdown.stop.prevent="this.columnWidths.onStartResize"
                              t-on-dblclick="this.columnWidths.resetWidths"/>
                    </t>
                </th>
            </t>
        </t>
        <t t-else="">
            <t t-foreach="columns" t-as="column" t-key="column.id">
                <th t-if="column.type === 'field'"
                    t-att-data-name="column.name"
                    t-att-class="getColumnClass(column) + ' opacity-trigger-hover w-print-auto'"
                    t-on-pointerup="onColumnTitleMouseUp"
                    t-on-click="() => this.onClickSortColumn(column)"
                    t-on-keydown="(ev) => this.onCellKeydown(ev)"
                    data-tooltip-delay="1000"
                    t-att-data-merge-column-id="column.id"
                    tabindex="-1">
                    <t t-if="column.hasLabel and column.widget !== 'handle'">
                        <t t-set="isNumeric" t-value="isNumericColumn(column)"/>
                        <div class="d-flex align-items-center"
                             t-att-data-tooltip-template="isDebugMode ? 'web.FieldTooltip' : 'web.ListHeaderTooltip'"
                             t-att-data-tooltip-info="makeTooltip(column)">
                            <span class="d-block min-w-0 text-truncate flex-grow-1 flex-shrink-1" t-att-class="isNumeric ? 'o_list_number_th' : ''" t-esc="column.label"/>
                            <div class="o_list_header_label_spacer"/>
                            <i class="o_list_sortable_icon" t-att-class="getSortableIconClass(column)"/>
                        </div>
                        <span class="o_resize position-absolute top-0 end-0 bottom-0 ps-1 bg-black-25 opacity-0 opacity-50-hover z-1"
                              t-on-pointerdown.stop.prevent="this.columnWidths.onStartResize"
                              t-on-dblclick="this.columnWidths.resetWidths"/>
                    </t>
                </th>
                <th t-else="" t-on-keydown="(ev) => this.onCellKeydown(ev)" t-att-class="{'o_list_button w-print-0 p-print-0': column.type === 'button_group'}"/>
            </t>
        </t>
        <th t-if="hasOpenFormViewColumn" t-att-rowspan="hasGroupedHeaders() ? 2 : 1" t-on-keydown="(ev) => this.onCellKeydown(ev)" class="o_list_open_form_view w-print-0 p-print-0 align-middle" data-merge-column-id="open_form"/>
        <th t-if="hasActionsColumn" t-att-rowspan="hasGroupedHeaders() ? 2 : 1" t-on-keydown="(ev) => this.onCellKeydown(ev)" class="o_list_controller o_list_actions_header w-print-0 p-print-0 position-sticky end-0 align-middle" data-merge-column-id="actions">
            <div class="d-flex align-items-center justify-content-center border-top-0">
                <button t-if="headerConfigState.canEdit" class="btn p-0 me-2 o_list_merge_edit_btn" t-on-click="openHeaderEditor" title="Edit Merged Headers">
                    <i class="fa fa-columns text-primary"/>
                </button>
                <div t-if="displayOptionalFields or hasOptionalOpenFormViewColumn" class="o_optional_columns_dropdown d-print-none text-center border-top-0">
                    <Dropdown position="'bottom-end'">
                        <button class="btn p-0" tabindex="-1">
                            <i class="o_optional_columns_dropdown_toggle oi oi-fw oi-settings-adjust"/>
                        </button>
                        <t t-set-slot="content">
                            <t t-foreach="optionalFieldGroups" t-as="group" t-key="group_index">
                                <div t-if="!group_first" role="separator" class="dropdown-divider"/>
                                <DropdownItem t-if="group.displayName" closingMode="'none'" onSelected="() => this.toggleOptionalFieldGroup(group.id)">
                                    <div class="fw-bold" t-esc="group.displayName"/>
                                </DropdownItem>
                                <t t-foreach="group.optionalFields" t-as="field" t-key="field_index">
                                    <DropdownItem closingMode="'none'" onSelected="() => this.toggleOptionalField(field.name)">
                                        <CheckBox onChange="() => this.toggleOptionalField(field.name)" value="field.value" name="field.name">
                                            <span class="d-flex align-items-center"><span class="text-truncate" t-esc="field.label"/><span class="ps-1" t-if="env.debug" t-esc="' (' + field.name + ')'" /></span>
                                        </CheckBox>
                                    </DropdownItem>
                                </t>
                            </t>
                            <div t-if="hasOptionalOpenFormViewColumn" role="separator" class="dropdown-divider"/>
                            <DropdownItem t-if="hasOptionalOpenFormViewColumn" closingMode="'none'" onSelected="() => this.toggleDebugOpenView()">
                                <CheckBox onChange="() => this.toggleDebugOpenView()" value="this.debugOpenView" name="'View Button'">
                                    <span class="d-flex align-items-center"><span class="text-truncate">View Button</span></span>
                                </CheckBox>
                            </DropdownItem>
                        </t>
                    </Dropdown>
                </div>
            </div>
        </th>
        <th t-if="!hasActionsColumn and headerConfigState.canEdit"
            t-att-rowspan="hasGroupedHeaders() ? 2 : 1"
            t-on-keydown="(ev) => this.onCellKeydown(ev)"
            class="o_list_controller o_list_merge_edit_only w-print-0 p-print-0 position-sticky end-0 align-middle"
            data-merge-column-id="merge_edit">
            <div class="d-flex align-items-center justify-content-center">
                <button class="btn p-0 o_list_merge_edit_btn" t-on-click="openHeaderEditor" title="Edit Merged Headers">
                    <i class="fa fa-columns text-primary"/>
                </button>
            </div>
        </th>
    </tr>
    <!-- Row 2 -->
    <tr t-if="hasGroupedHeaders()">
        <t t-foreach="getRow2Cells()" t-as="column" t-key="column.id">
            <th t-att-data-name="column.name"
                t-att-class="getColumnClass(column) + ' opacity-trigger-hover w-print-auto align-middle' + (isGroupCentered(column) ? ' o_list_merge_center' : '')"
                t-on-pointerup="onColumnTitleMouseUp"
                t-on-click="() => this.onClickSortColumn(column)"
                t-on-keydown="(ev) => this.onCellKeydown(ev)"
                data-tooltip-delay="1000"
                t-att-data-merge-column-id="column.id"
                tabindex="-1">
                <t t-if="column.hasLabel and column.widget !== 'handle'">
                    <t t-set="isNumeric" t-value="isNumericColumn(column)"/>
                    <div class="d-flex align-items-center"
                         t-att-data-tooltip-template="isDebugMode ? 'web.FieldTooltip' : 'web.ListHeaderTooltip'"
                         t-att-data-tooltip-info="makeTooltip(column)">
                        <span class="d-block min-w-0 text-truncate flex-grow-1 flex-shrink-1" t-att-class="isNumeric ? 'o_list_number_th' : ''" t-esc="column.label"/>
                        <div class="o_list_header_label_spacer"/>
                        <i class="o_list_sortable_icon" t-att-class="getSortableIconClass(column)"/>
                    </div>
                    <span class="o_resize position-absolute top-0 end-0 bottom-0 ps-1 bg-black-25 opacity-0 opacity-50-hover z-1"
                          t-on-pointerdown.stop.prevent="this.columnWidths.onStartResize"
                          t-on-dblclick="this.columnWidths.resetWidths"/>
                </t>
            </th>
        </t>
    </tr>
</thead>
`;

registerTemplateProcessor((doc) => {
    const thead = doc.querySelector("thead");
    if (!thead) return;

    const hasColumnsLoop = thead.querySelector("[t-foreach='columns']") || 
                           thead.querySelector("[t-foreach*='columns']") || 
                           thead.querySelector("[t-foreach*='getRow1Cells']");
    if (!hasColumnsLoop) return;

    if (thead.querySelector("[data-merge-column-id]")) return;

    const parsedDoc = parser.parseFromString(newTheadXmlString, "text/xml");
    if (parsedDoc.getElementsByTagName("parsererror").length) {
        console.error("Failed to parse new thead XML:", parsedDoc.getElementsByTagName("parsererror")[0].textContent);
        return;
    }

    const newThead = doc.importNode(parsedDoc.documentElement, true);
    thead.replaceWith(newThead);
});

patch(ListRenderer.prototype, {
    setup() {
        super.setup(...arguments);
        this.dialogService = useService("dialog");

        this.headerConfigState = useState({
            groups: [],
            centerHeaders: false,
            canEdit: false,
            loaded: false,
        });

        onWillStart(async () => {
            await this.loadHeaderConfig();
        });


        onMounted(() => {
            const table = this.tableRef.el;
            if (!table) return;

            const self = this;
            const originalQuerySelectorAll = table.querySelectorAll;
            table.querySelectorAll = function (selector) {
                if (selector === "thead th") {
                    return self.getOrderedHeaders();
                }
                return originalQuerySelectorAll.apply(this, arguments);
            };

            if (this.columnWidths && this.columnWidths.onStartResize) {
                const originalOnStartResize = this.columnWidths.onStartResize;
                this.columnWidths.onStartResize = (ev) => {
                    const th = ev.target.closest("th");
                    if (!th) {
                        return originalOnStartResize(ev);
                    }
                    const colId = th.getAttribute("data-merge-column-id");
                    if (!colId) {
                        return originalOnStartResize(ev);
                    }

                    originalOnStartResize(ev);

                    let cellIndex = -1;
                    if (colId === "selector") {
                        cellIndex = 0;
                    } else if (colId === "open_form") {
                        cellIndex = (this.hasSelectors ? 1 : 0) + this.columns.length;
                    } else if (colId === "actions") {
                        cellIndex = (this.hasSelectors ? 1 : 0) + this.columns.length + (this.hasOpenFormViewColumn ? 1 : 0);
                    } else {
                        const idx = this.columns.findIndex((c) => c.id === colId);
                        if (idx !== -1) {
                            cellIndex = idx + (this.hasSelectors ? 1 : 0);
                        }
                    }

                    if (cellIndex !== -1) {
                        const rows = table.querySelectorAll("tr");
                        const resizingCells = [];
                        for (const row of rows) {
                            const cell = row.children[cellIndex];
                            if (cell) {
                                cell.classList.add("o_column_resizing");
                                resizingCells.push(cell);
                            }
                        }

                        const stopResizeCleanup = () => {
                            for (const cell of resizingCells) {
                                cell.classList.remove("o_column_resizing");
                            }
                            window.removeEventListener("pointerup", stopResizeCleanup);
                        };
                        window.addEventListener("pointerup", stopResizeCleanup);
                    }
                };
            }
        });
    },

    /**
     * Override so data-row cells follow the same reordered column sequence
     * as the merged header, keeping header and body perfectly aligned.
     */
    get mergedColumns() {
        if (this.headerConfigState.loaded && this.headerConfigState.groups.length > 0) {
            return this.reorderColumnsForGroups(this.columns, this.headerConfigState.groups);
        }
        return this.columns;
    },

    /**
     * Override so data-row cells follow the same reordered column sequence
     * as the merged header, keeping header and body perfectly aligned.
     */
    getColumns(_record) {
        return this.mergedColumns;
    },

    getViewKey() {
        const viewId = (this.env.config && this.env.config.viewId) || "";
        const model = this.props.list.resModel;
        const isSubView = !!this.props.nestedKeyOptionalFieldsData;
        if (isSubView) {
            const relField = this.props.nestedKeyOptionalFieldsData.field || "";
            return `sub_${viewId}_${relField}_${model}`;
        }
        if (viewId) {
            return `view_${viewId}`;
        }
        return `model_${model}`;
    },

    async loadHeaderConfig() {
        const viewKey = this.getViewKey();
        const viewId = (this.env.config && this.env.config.viewId) || null;
        try {
            const res = await this.orm.call(
                "list.view.header.config",
                "get_config_for_view_by_key",
                [viewKey, viewId]
            );
            const newGroups = (res && res.header_config) || [];
            this.headerConfigState.groups.splice(0, this.headerConfigState.groups.length, ...newGroups);
            this.headerConfigState.centerHeaders = (res && res.center_headers) || false;
            this.headerConfigState.canEdit = (res && res.can_edit) || false;
            this.headerConfigState.loaded = true;
        } catch (e) {
            console.error("Failed to load header config:", e);
        }
    },

    reorderColumnsForGroups(columns, groups) {
        let reordered = [...columns];
        for (const group of groups) {
            if (!group) continue;
            const groupFields = group.fields || [];
            const indices = [];
            reordered.forEach((col, idx) => {
                if (col.type === "field" && groupFields.includes(col.name)) {
                    indices.push(idx);
                }
            });
            if (indices.length <= 1) {
                continue;
            }
            const targetIdx = indices[0];
            const members = indices.map((idx) => reordered[idx]);
            for (let i = indices.length - 1; i >= 0; i--) {
                reordered.splice(indices[i], 1);
            }
            reordered.splice(targetIdx, 0, ...members);
        }
        return reordered;
    },

    openHeaderEditor() {
        this.dialogService.add(HeaderEditor, {
            columns: this.columns,
            config: this.headerConfigState.groups,
            centerHeaders: this.headerConfigState.centerHeaders,
            save: async (newConfig, centerHeaders) => {
                const viewKey = this.getViewKey();
                const viewId = (this.env.config && this.env.config.viewId) || null;
                await this.orm.call("list.view.header.config", "save_config_for_view_by_key", [
                    viewKey,
                    newConfig,
                    centerHeaders,
                    viewId,
                ]);
                this.headerConfigState.groups.splice(0, this.headerConfigState.groups.length, ...newConfig);
                this.headerConfigState.centerHeaders = centerHeaders;
                if (this.columnWidths && this.columnWidths.resetWidths) {
                    this.columnWidths.resetWidths();
                }
            },
        });
    },

    getOrderedHeaders() {
        const table = this.tableRef.el;
        if (!table) return [];

        const ordered = [];
        if (this.hasSelectors) {
            const el = table.querySelector('thead th[data-merge-column-id="selector"]');
            if (el) ordered.push(el);
        }

        const cols = this.mergedColumns || this.columns;
        for (const col of cols) {
            const el = table.querySelector(`thead th[data-merge-column-id="${col.id}"]`);
            if (el) ordered.push(el);
        }

        if (this.hasOpenFormViewColumn) {
            const el = table.querySelector('thead th[data-merge-column-id="open_form"]');
            if (el) ordered.push(el);
        }

        if (this.hasActionsColumn) {
            const el = table.querySelector('thead th[data-merge-column-id="actions"]');
            if (el) ordered.push(el);
        }

        return ordered;
    },

    hasGroupedHeaders() {
        if (!this.headerConfigState.loaded || this.headerConfigState.groups.length === 0) {
            return false;
        }
        const cols = this.mergedColumns || this.columns;
        const activeFieldNames = new Set(cols.filter((c) => c.type === "field").map((c) => c.name));
        return this.headerConfigState.groups.some((group) => {
            if (!group) return false;
            const activeGroupFields = (group.fields || []).filter((f) => activeFieldNames.has(f));
            return activeGroupFields.length > 0;
        });
    },

    getRow1Cells() {
        const cells = [];
        const cols = this.mergedColumns || this.columns;
        const activeFieldNames = new Set(cols.filter((c) => c.type === "field").map((c) => c.name));

        const fieldToGroupMap = {};
        const groupToActiveFieldsMap = {};

        this.headerConfigState.groups.forEach((group, gIdx) => {
            if (!group) return;
            const activeFields = (group.fields || []).filter((f) => activeFieldNames.has(f));
            if (activeFields.length > 0) {
                groupToActiveFieldsMap[gIdx] = activeFields;
                activeFields.forEach((f) => {
                    fieldToGroupMap[f] = gIdx;
                });
            }
        });

        const emittedGroups = new Set();

        for (const col of cols) {
            if (col.type === "field" && col.name in fieldToGroupMap) {
                const gIdx = fieldToGroupMap[col.name];
                if (!emittedGroups.has(gIdx)) {
                    emittedGroups.add(gIdx);
                    const group = this.headerConfigState.groups[gIdx];
                    const activeFieldsCount = groupToActiveFieldsMap[gIdx].length;
                    cells.push({
                        id: `group_${gIdx}`,
                        isGroup: true,
                        label: group.label,
                        center: group.center,
                        colspan: activeFieldsCount,
                    });
                }
            } else {
                cells.push({
                    id: `col_${col.id}`,
                    isGroup: false,
                    column: col,
                });
            }
        }
        return cells;
    },

    getRow2Cells() {
        const cells = [];
        const cols = this.mergedColumns || this.columns;
        const activeFieldNames = new Set(cols.filter((c) => c.type === "field").map((c) => c.name));

        const groupedFields = new Set();
        this.headerConfigState.groups.forEach((group) => {
            if (!group) return;
            const activeFields = (group.fields || []).filter((f) => activeFieldNames.has(f));
            if (activeFields.length > 0) {
                activeFields.forEach((f) => groupedFields.add(f));
            }
        });

        for (const col of cols) {
            if (col.type === "field" && groupedFields.has(col.name)) {
                cells.push(col);
            }
        }
        return cells;
    },

    get nbCols() {
        let n = super.nbCols;
        if (!this.hasActionsColumn && this.headerConfigState.canEdit) {
            n++;
        }
        return n;
    },

    isGroupCentered(column) {
        if (!column || column.type !== "field") return false;
        const group = this.headerConfigState.groups.find(
            (g) => g && (g.fields || []).includes(column.name)
        );
        return group ? !!group.center : false;
    },
});
