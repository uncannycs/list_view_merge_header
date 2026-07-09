# -*- coding: utf-8 -*-


# -*- coding: utf-8 -*-
##############################################################################
#
#    ODOO Open Source Management Solution
#
#    ODOO Addon module by Uncanny Consulting Services LLP
#    Copyright (C) 2023 Uncanny Consulting Services LLP (<https://uncannycs.com>).
#
##############################################################################
{
    'name': 'List View Merge Header Ucs',
    'version': '19.0.1.0.0',
    'summary': 'Group list view columns under one custom, renamable header',
    'description': """
        Merge several columns of any list (tree) view under a single,
        custom-named header — straight from the user interface, with no view
        editing or code. A two-row header is rendered: the group label spans
        its columns, with each field shown underneath.

        Key Features:
        - Inline header editor, opened from any list view.
        - Drag fields into a column to group them, and rename each header.
        - Drag a whole column group into another to combine them.
        - Optionally center the header text.
        - Works in embedded one2many / many2many list views too.
        - The layout is global — shared by all users.
        - Security group controls who can edit the layout.
    """,
    'category': 'Extra Tools',
    "website": "https://uncannycs.com",
    "author": "Uncanny Consulting Services LLP",
    "maintainer": "Uncanny Consulting Services LLP",
    "license": "Other proprietary",
    'depends': ['web', 'base'],
    'data': [
        'security/security_groups.xml',
        'security/ir.model.access.csv',
        'views/res_config_settings_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'list_view_merge_header/static/src/css/list_merge_header.css',
            'list_view_merge_header/static/src/components/list_merge_header/list_merge_header.js',
            'list_view_merge_header/static/src/components/list_merge_header/list_merge_header.xml',
            'list_view_merge_header/static/src/components/header_editor/header_editor.js',
            'list_view_merge_header/static/src/components/header_editor/header_editor.xml',
        ],
    },
    'installable': True,
    'auto_install': False,
    'application': False,
}
