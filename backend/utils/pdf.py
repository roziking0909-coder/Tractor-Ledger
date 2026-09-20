"""
Tractor Ledger - PDF / HTML Template Utility
Generates a styled HTML ledger for a farmer, suitable for printing or PDF conversion.
"""

from datetime import datetime
from models.farmer import format_indian_currency


def generate_farmer_ledger_html(
    owner_name: str,
    farmer_name: str,
    farmer_village: str,
    farmer_mobile: str,
    date_from: str,
    date_to: str,
    work_entries: list[dict],
    payments: list[dict],
    total_work_amount: float,
    total_paid: float,
    remaining_due: float,
) -> str:
    """
    Generate a complete, styled HTML page for a farmer's ledger.
    Designed for clean printing on A4 paper.
    """

    # ---- Build work entries rows ----
    work_rows = ""
    if work_entries:
        for i, entry in enumerate(work_entries, 1):
            work_rows += f"""
            <tr>
                <td class="center">{i}</td>
                <td class="center">{_format_date(entry.get('date', ''))}</td>
                <td>{entry.get('farm_name', '-')}</td>
                <td>{entry.get('work_type', '')}</td>
                <td class="center">{entry.get('quantity', '')} {entry.get('quantity_unit', '')}</td>
                <td class="right">{format_indian_currency(entry.get('rate', 0))}</td>
                <td class="right">{format_indian_currency(entry.get('total_amount', 0))}</td>
            </tr>"""
    else:
        work_rows = """
            <tr>
                <td colspan="7" class="center" style="padding: 20px; color: #999;">
                    No work entries found for this period.
                </td>
            </tr>"""

    # ---- Build payment rows ----
    payment_rows = ""
    if payments:
        for i, payment in enumerate(payments, 1):
            payment_rows += f"""
            <tr>
                <td class="center">{i}</td>
                <td class="center">{_format_date(payment.get('payment_date', ''))}</td>
                <td class="right">{format_indian_currency(payment.get('amount', 0))}</td>
                <td>{payment.get('notes', '-') or '-'}</td>
            </tr>"""
    else:
        payment_rows = """
            <tr>
                <td colspan="4" class="center" style="padding: 20px; color: #999;">
                    No payments recorded for this period.
                </td>
            </tr>"""

    # ---- Determine due status styling ----
    due_class = "due-positive" if remaining_due > 0 else "due-settled"
    due_label = "REMAINING DUE" if remaining_due > 0 else "SETTLED / OVERPAID"

    generated_at = datetime.now().strftime("%d %b %Y, %I:%M %p")

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ledger - {farmer_name}</title>
    <style>
        /* ---- Reset & Base ---- */
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 13px;
            color: #333;
            background: #fff;
            padding: 20px;
            max-width: 210mm;
            margin: 0 auto;
        }}

        /* ---- Header ---- */
        .header {{
            text-align: center;
            border-bottom: 3px solid #2c5530;
            padding-bottom: 15px;
            margin-bottom: 20px;
        }}

        .header h1 {{
            font-size: 24px;
            color: #2c5530;
            margin-bottom: 2px;
            letter-spacing: 1px;
        }}

        .header .subtitle {{
            font-size: 14px;
            color: #666;
        }}

        .header .owner {{
            font-size: 16px;
            color: #444;
            margin-top: 5px;
            font-weight: 600;
        }}

        /* ---- Info Cards ---- */
        .info-section {{
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            gap: 15px;
        }}

        .info-card {{
            flex: 1;
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            padding: 12px 15px;
        }}

        .info-card h3 {{
            font-size: 11px;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
        }}

        .info-card p {{
            font-size: 14px;
            color: #333;
            margin: 2px 0;
        }}

        .info-card .highlight {{
            font-weight: 700;
            font-size: 15px;
            color: #2c5530;
        }}

        /* ---- Tables ---- */
        .section-title {{
            font-size: 16px;
            color: #2c5530;
            font-weight: 700;
            margin: 25px 0 10px 0;
            padding-bottom: 5px;
            border-bottom: 2px solid #e8e8e8;
        }}

        table {{
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            font-size: 12px;
        }}

        thead th {{
            background: #2c5530;
            color: #fff;
            padding: 8px 10px;
            text-align: left;
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }}

        tbody td {{
            padding: 7px 10px;
            border-bottom: 1px solid #eee;
        }}

        tbody tr:nth-child(even) {{
            background: #f9f9f9;
        }}

        tbody tr:hover {{
            background: #f0f7f0;
        }}

        .center {{ text-align: center; }}
        .right {{ text-align: right; }}

        /* ---- Summary Box ---- */
        .summary {{
            display: flex;
            justify-content: flex-end;
            margin-top: 20px;
        }}

        .summary-box {{
            width: 320px;
            border: 2px solid #2c5530;
            border-radius: 8px;
            overflow: hidden;
        }}

        .summary-row {{
            display: flex;
            justify-content: space-between;
            padding: 10px 15px;
            border-bottom: 1px solid #e8e8e8;
        }}

        .summary-row:last-child {{
            border-bottom: none;
        }}

        .summary-row .label {{
            font-weight: 600;
            color: #555;
        }}

        .summary-row .value {{
            font-weight: 700;
            font-size: 14px;
        }}

        .due-positive {{
            background: #fff3cd;
            color: #856404;
        }}

        .due-settled {{
            background: #d4edda;
            color: #155724;
        }}

        .due-row {{
            font-size: 15px;
        }}

        /* ---- Footer ---- */
        .footer {{
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #ddd;
            display: flex;
            justify-content: space-between;
            color: #999;
            font-size: 11px;
        }}

        /* ---- Print Styles ---- */
        @media print {{
            body {{
                padding: 10px;
                font-size: 11px;
            }}

            .header h1 {{
                font-size: 20px;
            }}

            table {{
                font-size: 10px;
            }}

            thead th {{
                padding: 5px 8px;
            }}

            tbody td {{
                padding: 4px 8px;
            }}

            .info-section {{
                gap: 8px;
            }}

            @page {{
                margin: 10mm;
                size: A4;
            }}
        }}
    </style>
</head>
<body>
    <!-- Header -->
    <div class="header">
        <h1>🚜 TRACTOR LEDGER</h1>
        <div class="subtitle">Work & Payment Statement</div>
        <div class="owner">{owner_name}</div>
    </div>

    <!-- Farmer Info & Date Range -->
    <div class="info-section">
        <div class="info-card">
            <h3>Farmer Details</h3>
            <p class="highlight">{farmer_name}</p>
            <p>📍 {farmer_village or 'N/A'}</p>
            <p>📱 {farmer_mobile or 'N/A'}</p>
        </div>
        <div class="info-card">
            <h3>Report Period</h3>
            <p><strong>From:</strong> {_format_date(date_from)}</p>
            <p><strong>To:</strong> {_format_date(date_to)}</p>
        </div>
    </div>

    <!-- Work Entries Table -->
    <div class="section-title">📋 Work Entries</div>
    <table>
        <thead>
            <tr>
                <th class="center" style="width:40px;">#</th>
                <th class="center" style="width:90px;">Date</th>
                <th>Farm</th>
                <th>Work Type</th>
                <th class="center">Qty</th>
                <th class="right" style="width:90px;">Rate</th>
                <th class="right" style="width:100px;">Amount</th>
            </tr>
        </thead>
        <tbody>
            {work_rows}
        </tbody>
    </table>

    <!-- Payments Table -->
    <div class="section-title">💰 Payment History</div>
    <table>
        <thead>
            <tr>
                <th class="center" style="width:40px;">#</th>
                <th class="center" style="width:100px;">Date</th>
                <th class="right" style="width:120px;">Amount</th>
                <th>Notes</th>
            </tr>
        </thead>
        <tbody>
            {payment_rows}
        </tbody>
    </table>

    <!-- Summary -->
    <div class="summary">
        <div class="summary-box">
            <div class="summary-row">
                <span class="label">Total Work Amount</span>
                <span class="value">{format_indian_currency(total_work_amount)}</span>
            </div>
            <div class="summary-row">
                <span class="label">Total Paid</span>
                <span class="value" style="color: #28a745;">{format_indian_currency(total_paid)}</span>
            </div>
            <div class="summary-row due-row {due_class}">
                <span class="label">{due_label}</span>
                <span class="value">{format_indian_currency(abs(remaining_due))}</span>
            </div>
        </div>
    </div>

    <!-- Footer -->
    <div class="footer">
        <span>Generated on {generated_at}</span>
        <span>Tractor Ledger</span>
    </div>
</body>
</html>"""

    return html


def _format_date(date_str: str) -> str:
    """
    Format a date string (YYYY-MM-DD) to a readable format (DD MMM YYYY).
    Falls back to original string if parsing fails.
    """
    if not date_str or date_str in ("All time", "Present"):
        return date_str or ""

    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.strftime("%d %b %Y")
    except (ValueError, TypeError):
        return date_str
