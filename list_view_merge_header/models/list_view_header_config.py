# -*- coding: utf-8 -*-
import json
from odoo import api, fields, models, _
from odoo.exceptions import AccessError


class ListViewHeaderConfig(models.Model):
    """
    Stores per-view merged-header configurations.
    Each record maps a (view_key, view_id) pair to a JSON layout.
    The layout is global: every user sees the same merged headers.
    """
    _name = 'list.view.header.config'
    _description = 'List View Merge Header Configuration'

    name = fields.Char(
        string='Name',
        compute='_compute_name',
        store=True,
    )
    view_id = fields.Many2one(
        'ir.ui.view',
        string='View',
        required=False,
        ondelete='cascade',
        index=True,
    )
    view_key = fields.Char(
        string='View Key',
        required=True,
        index=True,
    )
    model_name = fields.Char(
        string='Model',
        required=False,
        index=True,
    )
    # JSON: list of group objects
    # [{
    #   "label": "Group Label",
    #   "center": false,
    #   "fields": ["field_name1", "field_name2"]
    # }]
    header_config = fields.Text(
        string='Header Configuration (JSON)',
        default='[]',
    )
    center_headers = fields.Boolean(
        string='Center Header Text',
        default=False,
    )
    active = fields.Boolean(
        string='Active',
        default=True,
    )

    _sql_constraints = [
        (
            'unique_view_key',
            'UNIQUE(view_key)',
            'Only one header configuration per view key is allowed.',
        )
    ]

    @api.depends('view_id', 'view_key', 'model_name')
    def _compute_name(self):
        for rec in self:
            view_name = rec.view_id.name if rec.view_id else ''
            label = view_name or rec.view_key
            rec.name = f'Header Config – {label} ({rec.model_name or "N/A"})'

    
    @api.model
    def get_config_for_view_by_key(self, view_key, view_id=None):
        """
        Return the stored header config for a given view_key (string).
        """
        record = self.sudo().search([('view_key', '=', view_key)], limit=1)
        if not record and view_id:
            record = self.sudo().search([('view_id', '=', view_id), ('view_key', '=', False)], limit=1)
            if record:
                record.view_key = view_key

        if not record:
            return {
                'header_config': [],
                'center_headers': False,
                'can_edit': self.can_edit(),
            }

        try:
            config = json.loads(record.header_config or '[]')
        except (ValueError, TypeError):
            config = []

        return {
            'id': record.id,
            'header_config': config,
            'center_headers': record.center_headers,
            'can_edit': self.can_edit(),
        }

    @api.model
    def save_config_for_view_by_key(self, view_key, header_config, center_headers=False, view_id=None):
        """
        Upsert the header config for a given view key.
        Only members of 'list_view_merge_header.group_edit_list_header' may call this.
        """
        if not self.can_edit():
            raise AccessError(
                _('You do not have permission to edit the list view header.')
            )

        config_json = json.dumps(header_config or [])
        record = self.sudo().search([('view_key', '=', view_key)], limit=1)

        model_name = False
        if view_id:
            view = self.env['ir.ui.view'].sudo().browse(view_id)
            if view.exists():
                model_name = view.model
        
        if not model_name:
            parts = view_key.split('_')
            if len(parts) > 1:
                model_name = parts[-1]

        vals = {
            'header_config': config_json,
            'center_headers': center_headers,
            'view_key': view_key,
        }
        if model_name:
            vals['model_name'] = model_name
        if view_id:
            vals['view_id'] = view_id

        if record:
            record.sudo().write(vals)
        else:
            if not view_id:
                parts = view_key.split('_')
                for part in parts:
                    if part.isdigit():
                        vals['view_id'] = int(part)
                        break
            self.sudo().create(vals)

        return {'success': True}

    @api.model
    def delete_config_for_view_by_key(self, view_key):
        """
        Remove the header config for a given view (reset to default).
        Requires the edit group.
        """
        if not self.can_edit():
            raise AccessError(
                _('You do not have permission to reset the list view header.')
            )
        record = self.sudo().search([('view_key', '=', view_key)], limit=1)
        if record:
            record.sudo().unlink()
        return {'success': True}

    @api.model
    def can_edit(self):
        """Return True if the current user can edit list-view headers."""
        return self.env.user.has_group('list_view_merge_header.group_edit_list_header')
