import { Component, useState } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";

export class HeaderEditor extends Component {
    static template = "list_view_merge_header.HeaderEditor";
    static components = { Dialog };
    static props = {
        columns: Array,
        config: Array,
        centerHeaders: Boolean,
        save: Function,
        close: Function,
    };

    setup() {
        const initialGroups = (this.props.config || []).map(group => ({
            label: group.label || "Group",
            center: group.center || false,
            fields: [...(group.fields || [])],
        }));

        this.state = useState({
            groups: initialGroups,
            centerHeaders: this.props.centerHeaders || false,
            draggedField: null,
            draggedGroupIndex: null,
        });
    }

    get viewFields() {
        return this.props.columns.filter(col => col.type === "field");
    }

    get availableFields() {
        const groupedFieldNames = new Set();
        this.state.groups.forEach(g => {
            g.fields.forEach(f => groupedFieldNames.add(f));
        });
        return this.viewFields.filter(col => !groupedFieldNames.has(col.name));
    }

    getFieldLabel(fieldName) {
        const found = this.viewFields.find(col => col.name === fieldName);
        return found ? found.label : fieldName;
    }

    onDragStart(ev, fieldName) {
        this.state.draggedField = fieldName;
        this.state.draggedGroupIndex = null;
        ev.dataTransfer.setData("text/plain", fieldName);
        ev.dataTransfer.effectAllowed = "move";
    }

    onDragStartGroup(ev, groupIndex) {
        this.state.draggedGroupIndex = groupIndex;
        this.state.draggedField = null;
        ev.dataTransfer.setData("text/group-index", groupIndex.toString());
        ev.dataTransfer.effectAllowed = "move";
    }

    onDragOver(ev) {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = "move";
    }

    onDropOnGroup(ev, targetGroupIndex) {
        ev.preventDefault();
        ev.stopPropagation();
        
        const sourceGroupIndexStr = ev.dataTransfer.getData("text/group-index") || (this.state.draggedGroupIndex !== null ? this.state.draggedGroupIndex.toString() : "");
        if (sourceGroupIndexStr !== "") {
            const sourceGroupIndex = parseInt(sourceGroupIndexStr);
            if (isNaN(sourceGroupIndex) || sourceGroupIndex === targetGroupIndex) return;

            const sourceGroup = this.state.groups[sourceGroupIndex];
            const targetGroup = this.state.groups[targetGroupIndex];
            
            if (sourceGroup && targetGroup) {
                targetGroup.fields.push(...sourceGroup.fields);
                this.state.groups.splice(sourceGroupIndex, 1);
            }
            this.state.draggedGroupIndex = null;
            return;
        }

        const fieldName = ev.dataTransfer.getData("text/plain") || this.state.draggedField;
        if (!fieldName) return;

        this.removeFieldFromGroups(fieldName);

        const targetGroup = this.state.groups[targetGroupIndex];
        if (!targetGroup) return;
        targetGroup.fields.push(fieldName);
        this.state.draggedField = null;
    }

    onDropOnPalette(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        
        const sourceGroupIndexStr = ev.dataTransfer.getData("text/group-index") || (this.state.draggedGroupIndex !== null ? this.state.draggedGroupIndex.toString() : "");
        if (sourceGroupIndexStr !== "") {
            const sourceGroupIndex = parseInt(sourceGroupIndexStr);
            if (!isNaN(sourceGroupIndex)) {
                this.state.groups.splice(sourceGroupIndex, 1);
            }
            this.state.draggedGroupIndex = null;
            return;
        }

        const fieldName = ev.dataTransfer.getData("text/plain") || this.state.draggedField;
        if (!fieldName) return;

        this.removeFieldFromGroups(fieldName);
        this.state.draggedField = null;
    }

    removeFieldFromGroups(fieldName) {
        this.state.groups.forEach(g => {
            const idx = g.fields.indexOf(fieldName);
            if (idx !== -1) {
                g.fields.splice(idx, 1);
            }
        });
    }

    addGroup() {
        this.state.groups.push({
            label: "New Group",
            center: false,
            fields: [],
        });
    }

    removeGroup(groupIndex) {
        this.state.groups.splice(groupIndex, 1);
    }

    onGroupLabelChange(ev, groupIndex) {
        this.state.groups[groupIndex].label = ev.target.value;
    }

    removeFieldFromGroup(fieldName, groupIndex) {
        const group = this.state.groups[groupIndex];
        const idx = group.fields.indexOf(fieldName);
        if (idx !== -1) {
            group.fields.splice(idx, 1);
        }
    }

    async onSave() {
        const finalConfig = this.state.groups
            .filter(g => g.fields.length > 0)
            .map(g => ({
                label: g.label,
                center: g.center,
                fields: g.fields,
            }));
        await this.props.save(finalConfig, this.state.centerHeaders);
        this.props.close();
    }

    onReset() {
        this.props.save([], false);
        this.props.close();
    }
}
