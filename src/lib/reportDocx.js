// The whole report as a Word document, built from the same frozen report
// objects the /report page renders.
//
// Two things this deliberately does not do. It does not read a form: every
// number here comes from the `setReport` payload a run published, which is the
// same rule the printed page follows, so a document exported after an edit
// quotes the run rather than the edited form. And it does not re-round: the
// payload's values are already the strings the page shows, so the docx and the
// screen cannot disagree about a digit.
//
// The `docx` package is pure JS and runs in the browser, so nothing is
// generated on a server and nothing is fetched at run time. It is imported by
// the report page through a dynamic import, which keeps it in its own chunk:
// the page costs nothing until the button is pressed, and the chunk is still
// build output, so the service worker precaches it and the export works
// offline.

import {
	Document,
	HeadingLevel,
	Packer,
	Paragraph,
	Table,
	TableCell,
	TableRow,
	TextRun,
	WidthType,
	AlignmentType,
	BorderStyle
} from 'docx';

/** Half-points, the unit docx sizes text in. */
const SIZE = { body: 20, small: 16, caption: 16 };

const GREY = '595959';
const RULE = { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' };
const CELL_BORDERS = { top: RULE, bottom: RULE, left: RULE, right: RULE };

function cell(text, { bold = false, align = AlignmentType.LEFT, width = null } = {}) {
	return new TableCell({
		borders: CELL_BORDERS,
		width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
		children: [
			new Paragraph({
				alignment: align,
				spacing: { before: 40, after: 40 },
				children: [new TextRun({ text: String(text ?? ''), bold, size: SIZE.body })]
			})
		]
	});
}

/** A table whose header row repeats on every page. `tableHeader` is what Word
 * reads for that, and a report table that runs past a page break without its
 * header is unreadable, which is the whole reason this export exists rather
 * than a screenshot. */
function table(columns, rows, { firstColumnLabels = true } = {}) {
	const header = new TableRow({
		tableHeader: true,
		children: columns.map((c) => cell(c, { bold: true }))
	});
	const body = rows.map(
		(r) =>
			new TableRow({
				children: r.map((v, i) =>
					cell(v, {
						bold: firstColumnLabels && i === 0,
						align: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT
					})
				)
			})
	);
	return new Table({
		width: { size: 100, type: WidthType.PERCENTAGE },
		rows: [header, ...body]
	});
}

/** The input and summary blocks are label/value pairs rather than a grid, so
 * they get their own two-column table with a header naming the two columns. */
function kvTable(headerLabel, headerValue, rows) {
	return table(
		[headerLabel, headerValue],
		rows.map((r) => [r.label, r.value])
	);
}

function heading(text, level) {
	return new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 } });
}

function para(text, { size = SIZE.body, color = null, italics = false, after = 120 } = {}) {
	return new Paragraph({
		spacing: { after },
		children: [new TextRun({ text, size, color: color ?? undefined, italics })]
	});
}

/** One analysis: everything the report page shows for it, in the page's order,
 * so a reader can hold the two side by side. */
function analysisChildren(report, includeDiscussion) {
	const out = [heading(report.chapter, HeadingLevel.HEADING_1)];
	out.push(para(`${report.chapterRef} · generated ${report.generatedAt}`, { size: SIZE.small, color: GREY }));
	if (report.headline) {
		out.push(para(`${report.headline.label}: ${report.headline.value}`, { size: SIZE.body }));
	}

	if (report.inputs?.length) {
		out.push(heading('Inputs', HeadingLevel.HEADING_2));
		out.push(kvTable('Input', 'Value', report.inputs));
	}

	if (report.resultTable) {
		out.push(heading('Results', HeadingLevel.HEADING_2));
		out.push(table(report.resultTable.columns, report.resultTable.rows));
	}
	if (report.summary?.length) {
		out.push(para('', { after: 80 }));
		out.push(kvTable('Summary', 'Value', report.summary));
	}

	// The builder's time-space domain, as the letters themselves. The page
	// prints letters rather than a colour scale for the same reason a document
	// does: a fill does not survive greyscale at cell size.
	if (report.matrixTable) {
		out.push(heading(report.matrixTable.title, HeadingLevel.HEADING_3));
		out.push(table(report.matrixTable.columns, report.matrixTable.rows));
		if (report.matrixTable.caption) {
			out.push(para(report.matrixTable.caption, { size: SIZE.caption, color: GREY, italics: true }));
		}
	}

	if (includeDiscussion && report.discussion?.length) {
		out.push(heading('Discussion', HeadingLevel.HEADING_2));
		for (const line of report.discussion) out.push(para(line));
	}

	if (report.methodology?.length) {
		out.push(heading('Methodology', HeadingLevel.HEADING_2));
		for (const note of report.methodology) {
			out.push(new Paragraph({ text: note, bullet: { level: 0 }, spacing: { after: 80 } }));
		}
	}
	return out;
}

/** Every held analysis in one document, in the order the page tabs them. */
export function buildReportDocument(reportList, { includeDiscussion = true, generatedAt = '' } = {}) {
	const children = [
		heading('HCM Calculator — Analysis Report', HeadingLevel.TITLE),
		para(
			reportList.length === 1
				? `One analysis. Exported ${generatedAt}.`
				: `${reportList.length} analyses. Exported ${generatedAt}.`,
			{ size: SIZE.small, color: GREY }
		)
	];
	for (const report of reportList) children.push(...analysisChildren(report, includeDiscussion));
	children.push(
		para(
			'Generated by the HCM Calculator. Calculations run in a Rust core compiled to WebAssembly. This is an independent tool and is not affiliated with any organization; verify results independently before relying on them in engineering work.',
			{ size: SIZE.caption, color: GREY }
		)
	);

	return new Document({
		styles: {
			default: {
				document: { run: { font: 'Calibri', size: SIZE.body } }
			}
		},
		sections: [
			{
				// Portrait US Letter with one-inch margins, in twips. The package
				// defaults to A4, and a report printed on the wrong stock reflows.
				properties: {
					page: {
						size: { width: 12240, height: 15840 },
						margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
					}
				},
				children
			}
		]
	});
}

/** Build, pack and hand the browser a file. Kept beside the builder so the page
 * imports one thing and no component has to know about Blob URLs. */
export async function downloadReportDocx(reportList, options = {}) {
	const doc = buildReportDocument(reportList, options);
	const blob = await Packer.toBlob(doc);
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = options.filename ?? 'hcm-report.docx';
	document.body.appendChild(a);
	a.click();
	a.remove();
	// Revoked on the next task rather than immediately, because Safari reads the
	// href after the click returns.
	setTimeout(() => URL.revokeObjectURL(url), 0);
}
