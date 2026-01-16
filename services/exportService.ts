
import { Department, Sheet, RatingValue, Statistics } from '../types';

declare const jspdf: any;
declare const PptxGenJS: any;

export const exportService = {
  toPDF: (dept: Department, sheetName: string, sheet: Sheet, ratings: Record<number, Record<number, RatingValue>>, stats: Statistics) => {
    const { jsPDF } = (window as any).jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');

    // Header
    pdf.setFontSize(20);
    pdf.setTextColor(44, 62, 80);
    pdf.text("Matrice des Compétences - SCAP CB", 105, 20, { align: 'center' });
    
    pdf.setFontSize(14);
    pdf.text(`${dept.name} - ${sheetName}`, 105, 30, { align: 'center' });
    pdf.setFontSize(10);
    pdf.text(`Généré le: ${new Date().toLocaleDateString('fr-FR')}`, 105, 38, { align: 'center' });

    // Table
    const headers = ["#", "Tâches", ...sheet.employees];
    const data = sheet.tasks.map((task, taskIdx) => [
      (taskIdx + 1).toString(),
      task,
      ...sheet.employees.map((_, empIdx) => ratings[empIdx]?.[taskIdx]?.toString() || "0")
    ]);

    (pdf as any).autoTable({
      head: [headers],
      body: data,
      startY: 45,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [44, 62, 80] }
    });

    // Stats
    const finalY = (pdf as any).lastAutoTable.finalY;
    pdf.setFontSize(12);
    pdf.text("Statistiques Globales:", 14, finalY + 10);
    pdf.setFontSize(10);
    pdf.text(`Taux de compétence global: ${stats.globalCompetence.toFixed(2)}%`, 14, finalY + 17);

    pdf.save(`Matrice_${dept.name}_${sheetName}.pdf`);
  },

  toPPTX: (dept: Department, sheetName: string, sheet: Sheet, ratings: Record<number, Record<number, RatingValue>>, stats: Statistics) => {
    const pptx = new (window as any).PptxGenJS();
    
    // Title Slide
    let slide = pptx.addSlide();
    slide.addText("MATRICE DES COMPÉTENCES", { x: 0.5, y: 1.0, w: "90%", h: 1, fontSize: 36, bold: true, align: "center", color: "2C3E50" });
    slide.addText(`Département: ${dept.name}`, { x: 0.5, y: 2.2, w: "90%", fontSize: 24, align: "center", color: "3498DB" });
    slide.addText(`Service: ${sheet.service}`, { x: 0.5, y: 3.0, w: "90%", fontSize: 18, align: "center", color: "7F8C8D" });

    // Data Slide
    slide = pptx.addSlide();
    slide.addText("ÉVALUATIONS", { x: 0.5, y: 0.2, fontSize: 24, bold: true });
    
    const tableData = [
        ["#", "Tâche", ...sheet.employees],
        ...sheet.tasks.slice(0, 10).map((t, idx) => [
            (idx + 1).toString(),
            t.substring(0, 40),
            ...sheet.employees.map((_, eIdx) => ratings[eIdx]?.[idx]?.toString() || "0")
        ])
    ];

    slide.addTable(tableData, { x: 0.5, y: 0.8, w: "90%", fontSize: 9, border: { pt: 1, color: "BDC3C7" } });

    // Stats Slide
    slide = pptx.addSlide();
    slide.addText("ANALYSE DES COMPÉTENCES", { x: 0.5, y: 0.2, fontSize: 24, bold: true });
    slide.addText(`Taux de compétence global: ${stats.globalCompetence.toFixed(2)}%`, { x: 0.5, y: 1.0, fontSize: 20, color: "27AE60" });
    
    const chartData = [
        {
            name: "Compétence (%)",
            labels: sheet.employees,
            values: sheet.employees.map((_, i) => stats.individualCompetence[i])
        }
    ];
    slide.addChart(pptx.ChartType.bar, chartData, { x: 0.5, y: 1.8, w: 9, h: 4 });

    pptx.writeFile({ fileName: `Matrice_${dept.name}_${sheetName}.pptx` });
  }
};
