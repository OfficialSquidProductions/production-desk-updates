// A spreadsheet report of every breakdown, independent of schedule/filter state.
// Portable .productiondesk files remain the lossless, editable interchange format.
export function breakdownCSV(project) {
  const categories = project.categories || [], elements = project.elements || [];
  const byID = new Map(elements.map(element => [element.id, element]));
  const headers = ['Production', 'Breakdown ID', 'Type', 'Scene', 'Script Page',
    'Pages', 'Estimated Minutes', 'Synopsis', 'Comments', 'Banner'];
  const used = new Set(headers);
  for (const category of categories) {
    const base = 'Category: ' + category.name;
    let title = base, index = 2;
    while (used.has(title)) title = base + ' (' + index++ + ')';
    used.add(title); headers.push(title);
  }
  const rows = [headers];
  for (const scene of project.breakdowns || []) {
    const tagged = (scene.elements || []).map(id => byID.get(id)).filter(Boolean);
    rows.push([project.project || project.name, scene.id, scene.type, scene.scene,
      scene.scriptPage, scene.pages, scene.duration == null ? '' : scene.duration / 60000,
      scene.description, scene.comments, scene.bannerText,
      ...categories.map(category => tagged.filter(element => element.category === category.id)
        .map(element => element.name).join('\n'))]);
  }
  const cell = value => {
    let text = String(value ?? '');
    // Quoting alone does not prevent spreadsheet formula interpretation. Keep
    // text as text, following the existing schedule/shot CSV export convention.
    if (typeof value === 'string' && /^[\s]*[=+@\-\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  // UTF-8 BOM helps spreadsheet apps detect Unicode; all records use CRLF.
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
