const pool = require('../config/database');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// Exporter les ventes en Excel
exports.exportSalesToExcel = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const isAdmin = req.user.role_id === 1;
    const storeId = req.user.store_id;
    
    let query = `
      SELECT s.id, s.date_sate, 
             c.name || ' ' || c.surname as client,
             a.name_article,
             s.quantity,
             s.price,
             st.name as magasin
      FROM sale s
      JOIN client c ON s.id_client = c.id
      JOIN article a ON s.id_article = a.id
      LEFT JOIN store st ON s.store_id = st.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (!isAdmin) {
      params.push(storeId);
      query += ` AND s.store_id = $${params.length}`;
    }
    
    if (startDate) {
      params.push(startDate);
      query += ` AND s.date_sate >= $${params.length}`;
    }
    
    if (endDate) {
      params.push(endDate);
      query += ` AND s.date_sate <= $${params.length}`;
    }
    
    query += ' ORDER BY s.date_sate DESC';
    
    const result = await pool.query(query, params);
    
    // Créer le workbook Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Ventes');
    
    // Définir les colonnes
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Client', key: 'client', width: 30 },
      { header: 'Article', key: 'article', width: 30 },
      { header: 'Quantité', key: 'quantity', width: 15 },
      { header: 'Prix (FCFA)', key: 'price', width: 15 },
      { header: 'Magasin', key: 'magasin', width: 20 }
    ];
    
    // Style du header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    
    // Ajouter les données
    result.rows.forEach(sale => {
      worksheet.addRow({
        id: sale.id,
        date: new Date(sale.date_sate).toLocaleString('fr-FR'),
        client: sale.client,
        article: sale.name_article,
        quantity: sale.quantity,
        price: sale.price,
        magasin: sale.magasin
      });
    });
    
    // Ajouter les totaux
    const totalRow = worksheet.addRow({
      id: '',
      date: '',
      client: '',
      article: 'TOTAL',
      quantity: result.rows.reduce((sum, s) => sum + s.quantity, 0),
      price: result.rows.reduce((sum, s) => sum + parseInt(s.price), 0),
      magasin: ''
    });
    
    totalRow.font = { bold: true };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' }
    };
    
    // Envoyer le fichier
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=ventes_${Date.now()}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'export Excel',
      error: error.message
    });
  }
};

// Exporter le stock en Excel
exports.exportStockToExcel = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name_article, categorie, quantity, unit_price, 
             (quantity * unit_price) as valeur_totale,
             expiration_date
      FROM article
      ORDER BY categorie, name_article
    `);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Stock');
    
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Article', key: 'article', width: 30 },
      { header: 'Catégorie', key: 'categorie', width: 20 },
      { header: 'Quantité', key: 'quantity', width: 15 },
      { header: 'Prix Unitaire', key: 'unit_price', width: 15 },
      { header: 'Valeur Totale', key: 'valeur', width: 15 },
      { header: 'Expiration', key: 'expiration', width: 20 }
    ];
    
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF70AD47' }
    };
    
    result.rows.forEach(item => {
      const row = worksheet.addRow({
        id: item.id,
        article: item.name_article,
        categorie: item.categorie,
        quantity: item.quantity,
        unit_price: item.unit_price,
        valeur: item.valeur_totale,
        expiration: item.expiration_date ? new Date(item.expiration_date).toLocaleDateString('fr-FR') : 'N/A'
      });
      
      // Colorer en rouge si stock bas
      if (item.quantity < 10) {
        row.getCell('quantity').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF0000' }
        };
        row.getCell('quantity').font = { color: { argb: 'FFFFFFFF' }, bold: true };
      }
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=stock_${Date.now()}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'export du stock',
      error: error.message
    });
  }
};

// Générer une facture PDF
exports.generateInvoicePDF = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Récupérer la vente
    const saleResult = await pool.query(`
      SELECT s.*, 
             c.name as client_name, c.surname as client_surname, c.phone, c.address,
             a.name_article, a.unit_price,
             st.name as store_name, st.adresse as store_address, st.phone as store_phone
      FROM sale s
      JOIN client c ON s.id_client = c.id
      JOIN article a ON s.id_article = a.id
      JOIN store st ON s.store_id = st.id
      WHERE s.id = $1
    `, [id]);
    
    if (saleResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vente non trouvée'
      });
    }
    
    const sale = saleResult.rows[0];
    
    // Créer le PDF
    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=facture_${sale.id}.pdf`);
    
    doc.pipe(res);
    
    // En-tête
    doc.fontSize(20).text('FACTURE', { align: 'center' });
    doc.moveDown();
    
    // Informations magasin
    doc.fontSize(12).text(`${sale.store_name}`, { align: 'left' });
    doc.fontSize(10).text(sale.store_address || '');
    doc.text(`Tél: ${sale.store_phone || 'N/A'}`);
    doc.moveDown();
    
    // Informations client
    doc.fontSize(12).text('CLIENT:', { underline: true });
    doc.fontSize(10).text(`${sale.client_name} ${sale.client_surname}`);
    doc.text(`Tél: ${sale.phone || 'N/A'}`);
    doc.text(`Adresse: ${sale.address || 'N/A'}`);
    doc.moveDown();
    
    // Informations facture
    doc.fontSize(10).text(`Facture N°: ${sale.id}`, { align: 'right' });
    doc.text(`Date: ${new Date(sale.date_sate).toLocaleDateString('fr-FR')}`, { align: 'right' });
    doc.moveDown(2);
    
    // Tableau des articles
    const tableTop = doc.y;
    doc.fontSize(10).text('Article', 50, tableTop, { width: 200 });
    doc.text('Quantité', 250, tableTop, { width: 100 });
    doc.text('Prix Unit.', 350, tableTop, { width: 100 });
    doc.text('Total', 450, tableTop, { width: 100 });
    
    doc.moveTo(50, tableTop + 20).lineTo(550, tableTop + 20).stroke();
    
    const itemY = tableTop + 30;
    doc.text(sale.name_article, 50, itemY, { width: 200 });
    doc.text(sale.quantity.toString(), 250, itemY, { width: 100 });
    doc.text(`${sale.unit_price} FCFA`, 350, itemY, { width: 100 });
    doc.text(`${sale.price} FCFA`, 450, itemY, { width: 100 });
    
    doc.moveDown(3);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();
    
    // Total
    doc.fontSize(12).text(`TOTAL: ${sale.price} FCFA`, { align: 'right', bold: true });
    
    doc.moveDown(3);
    doc.fontSize(10).text('Merci pour votre confiance!', { align: 'center' });
    
    doc.end();
    
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération de la facture PDF',
      error: error.message
    });
  }
};