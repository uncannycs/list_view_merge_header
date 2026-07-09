/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { ListRenderer } from "@web/views/list/list_renderer";
import { HeaderEditor } from "../header_editor/header_editor";
import { useState, onMounted, onWillStart, App } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { templates } from "@web/core/assets";
import { registry } from "@web/core/registry";

const patchedTemplates = new Set();
function patchTemplates() {
    const baseTemplate = templates.documentElement.querySelector('[t-name="web.ListRenderer"]');
    if (!baseTemplate) return;

    const baseThead = baseTemplate.querySelector("thead");
    if (!baseThead) return;

    const targets = new Set([
        "account.sectionAndNoteListRenderer",
        "account.ListRenderer",
        "purchase.PurchaseListView",
        "hr_expense.ListRenderer",
        "loyalty.LoyaltyListRenderer",
        "lunch.WebListRenderer",
        "hr_skills.SkillsListRenderer"
    ]);

    const inherited = templates.documentElement.querySelectorAll('[t-inherit="web.ListRenderer"]');
    for (const el of inherited) {
        const name = el.getAttribute("t-name");
        if (name && name !== "web.ListRenderer") {
            targets.add(name);
        }
    }

    let modified = false;
    for (const name of targets) {
        if (patchedTemplates.has(name)) continue;
        const t = templates.documentElement.querySelector(`[t-name="${name}"]`);
        if (t) {
            const localThead = t.querySelector("thead");
            if (localThead) {
                localThead.replaceWith(baseThead.cloneNode(true));
                patchedTemplates.add(name);
                modified = true;
            }
        }
    }

    if (modified) {
        for (const app of App.apps) {
            app.addTemplates(templates, app);
        }
    }
}

registry.category("xml_templates").addEventListener("UPDATE", () => {
    patchTemplates();
});

patch(ListRenderer.prototype, {
    setup() {
        super.setup(...arguments);
        this.orm = useService("orm");
        this.dialogService = useService("dialog");

        this.headerConfigState = useState({
            groups: [],
            centerHeaders: false,
            canEdit: false,
            loaded: false,
        });

        patchTemplates();

        onWillStart(async () => {
            patchTemplates();
            await this.loadHeaderConfig();
        });

        onMounted(() => {
            const table = this.tableRef.el;
            if (!table) return;

            const self = this;
            const originalQuerySelectorAll = table.querySelectorAll.bind(table);
            table.querySelectorAll = function (selector) {
                if (selector && typeof selector === "string" && selector.startsWith("thead th")) {
                    let headers = self.getOrderedHeaders();
                    if (selector.includes(":not(.o_list_actions_header)")) {
                        headers = headers.filter(el => !el.classList.contains("o_list_actions_header"));
                    }
                    if (selector.includes(":not(.o_list_button)")) {
                        headers = headers.filter(el => !el.classList.contains("o_list_button"));
                    }
                    return headers;
                }
                return originalQuerySelectorAll(selector);
            };
        });
    },

    /**
     * Override so data-row cells follow the same reordered column sequence
     * as the merged header, keeping header and body perfectly aligned.
     */
    get mergedColumns() {
        if (this.headerConfigState.loaded && this.headerConfigState.groups.length > 0) {
            return this.reorderColumnsForGroups(this.state.columns, this.headerConfigState.groups);
        }
        return this.state.columns;
    },

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
            columns: this.state.columns,
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
                this.columnWidths = null;
                if (this.tableRef.el) {
                    this.freezeColumnWidths();
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

        const cols = this.mergedColumns || this.state.columns;
        for (const col of cols) {
            const el = table.querySelector(`thead th[data-merge-column-id="${col.id}"]`);
            if (el) ordered.push(el);
        }

        if (this.props.onOpenFormView) {
            const el = table.querySelector('thead th[data-merge-column-id="open_form"]');
            if (el) ordered.push(el);
        }

        if (this.displayOptionalFields || this.activeActions.onDelete) {
            const el = table.querySelector('thead th[data-merge-column-id="actions"]');
            if (el) ordered.push(el);
        }

        return ordered;
    },

    hasGroupedHeaders() {
        if (!this.headerConfigState.loaded || this.headerConfigState.groups.length === 0) {
            return false;
        }
        const cols = this.mergedColumns || this.state.columns;
        const activeFieldNames = new Set(cols.filter((c) => c.type === "field").map((c) => c.name));
        return this.headerConfigState.groups.some((group) => {
            if (!group) return false;
            const activeGroupFields = (group.fields || []).filter((f) => activeFieldNames.has(f));
            return activeGroupFields.length > 0;
        });
    },

    getRow1Cells() {
        const cells = [];
        const cols = this.mergedColumns || this.state.columns;
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
        const cols = this.mergedColumns || this.state.columns;
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
        let n = this.state.columns.length;
        if (this.hasSelectors) {
            n++;
        }
        if (this.activeActions.onDelete || this.displayOptionalFields) {
            n++;
        }
        if (this.props.onOpenFormView) {
            n++;
        }
        if (!this.activeActions.onDelete && !this.displayOptionalFields && this.headerConfigState.canEdit) {
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

    /**
     * Override to map columns correctly to their respective elements by data-merge-column-id,
     * avoiding crashes caused by raw nth-child queries when columns are grouped in two rows.
     */
    setDefaultColumnWidths() {
        if (this.hasGroupedHeaders && this.hasGroupedHeaders() && this.tableRef.el) {
            const widths = this.state.columns.map((col) => this.calculateColumnWidth(col));
            const sumOfRelativeWidths = widths
                .filter(({ type }) => type === "relative")
                .reduce((sum, { value }) => sum + value, 0);

            widths.forEach(({ type, value }, i) => {
                const col = this.state.columns[i];
                if (!col) return;
                const headerEl = this.tableRef.el.querySelector(`thead th[data-merge-column-id="${col.id}"]`);
                if (!headerEl) return;
                if (type === "absolute") {
                    if (this.isEmpty) {
                        headerEl.style.width = value;
                    } else {
                        headerEl.style.minWidth = value;
                    }
                } else if (type === "relative" && this.isEmpty) {
                    headerEl.style.width = `${((value / sumOfRelativeWidths) * 100).toFixed(2)}%`;
                }
            });
            return;
        }
        super.setDefaultColumnWidths();
    },
});
