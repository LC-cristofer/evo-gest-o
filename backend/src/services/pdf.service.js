/**
 * Serviço de geração de PDF
 * Gera ficha completa do funcionário em PDF usando PDFKit
 */

const PDFDocument = require('pdfkit');

/**
 * Gera PDF da ficha de um funcionário
 * @param {Object} employee - dados completos do funcionário (com joins)
 * @param {Object} benefits - lista de benefícios ativos
 * @param {Array}  history  - últimos eventos do histórico
 * @returns {Buffer}
 */
const generateEmployeePDF = (employee, benefits = [], history = []) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc    = new PDFDocument({ size: 'A4', margin: 50, info: {
      Title:   `Ficha - ${employee.full_name}`,
      Author:  'ONG Sistema',
      Subject: 'Ficha Funcional',
    }});

    doc.on('data',  chunk => chunks.push(chunk));
    doc.on('end',   ()    => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ─── Paleta ─────────────────────────────────────────────
    const BRAND   = '#1e40af'; // azul escuro
    const GRAY    = '#64748b';
    const LIGHT   = '#f1f5f9';
    const BLACK   = '#0f172a';
    const SUCCESS = '#059669';
    const DANGER  = '#dc2626';

    const pageW = doc.page.width  - 100; // largura útil
    const pageH = doc.page.height - 100;

    // ─── Funções helper ──────────────────────────────────────

    const field = (label, value, x, y, w = 150) => {
      doc.fontSize(7).fillColor(GRAY).text(label.toUpperCase(), x, y);
      doc.fontSize(9).fillColor(BLACK).text(value || '—', x, y + 12, { width: w, lineBreak: false });
    };

    const sectionHeader = (title, y) => {
      doc.rect(50, y, pageW, 20).fill(BRAND);
      doc.fontSize(8).fillColor('#ffffff').font('Helvetica-Bold')
        .text(title.toUpperCase(), 58, y + 6);
      doc.font('Helvetica');
      return y + 28;
    };

    const hrLine = (y) => {
      doc.moveTo(50, y).lineTo(50 + pageW, y).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    };

    // ─── Cabeçalho ───────────────────────────────────────────
    doc.rect(50, 50, pageW, 60).fill(BRAND);

    doc.fontSize(16).fillColor('#ffffff').font('Helvetica-Bold')
      .text('FICHA FUNCIONAL', 70, 65);

    doc.fontSize(9).fillColor('#bfdbfe').font('Helvetica')
      .text('Sistema de Gestão — ONG', 70, 85);

    // Data de geração (canto direito)
    doc.fontSize(7).fillColor('#93c5fd')
      .text(
        `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        400, 85, { align: 'right', width: 130 }
      );

    let y = 130;

    // ─── Box de identificação ────────────────────────────────
    doc.rect(50, y, pageW, 70).fill(LIGHT);

    // Iniciais / avatar
    doc.circle(85, y + 35, 25).fill(BRAND);
    const initials = employee.full_name.split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase();
    doc.fontSize(14).fillColor('#ffffff').font('Helvetica-Bold')
      .text(initials, 72, y + 27);

    // Nome e código
    doc.fontSize(14).fillColor(BLACK).font('Helvetica-Bold')
      .text(employee.full_name, 125, y + 10, { width: pageW - 100 });

    if (employee.social_name) {
      doc.fontSize(9).fillColor(GRAY).font('Helvetica')
        .text(`Nome social: ${employee.social_name}`, 125, y + 30);
    }

    doc.fontSize(8).fillColor(GRAY).font('Helvetica')
      .text(`Código: ${employee.employee_code || '—'}   |   CPF: ${employee.cpf}`, 125, y + 44);

    // Badge de status
    const statusColor = {
      ATIVO: SUCCESS, AFASTADO: '#d97706', DESLIGADO: DANGER, INATIVO: GRAY, PENDENTE: '#7c3aed',
    }[employee.status] || GRAY;
    const statusLabel = {
      ATIVO: 'ATIVO', AFASTADO: 'AFASTADO', DESLIGADO: 'DESLIGADO',
      INATIVO: 'INATIVO', PENDENTE: 'PENDENTE',
    }[employee.status] || employee.status;

    doc.rect(460, y + 10, 70, 16).fill(statusColor);
    doc.fontSize(7).fillColor('#ffffff').font('Helvetica-Bold')
      .text(statusLabel, 463, y + 14, { width: 64, align: 'center' });

    y += 85;

    // ─── Dados Pessoais ──────────────────────────────────────
    y = sectionHeader('Dados Pessoais', y);

    field('Data de Nascimento', employee.birth_date
      ? new Date(employee.birth_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—',
      50, y);
    field('Gênero',     employee.gender,       210, y);
    field('Nascimento', employee.place_of_birth, 340, y);
    field('Nacionalidade', employee.nationality, 460, y, 80);

    y += 36; hrLine(y); y += 8;

    field('RG',           employee.rg ? `${employee.rg} ${employee.rg_issuer ? '/ ' + employee.rg_issuer : ''}` : '—', 50, y);
    field('PIS/PASEP',    employee.pis_pasep,   210, y);
    field('CTPS',         employee.ctps_number ? `${employee.ctps_number} – Série: ${employee.ctps_series || '—'}` : '—', 340, y, 200);

    y += 40;

    // ─── Contato ─────────────────────────────────────────────
    y = sectionHeader('Contato e Endereço', y);

    field('Email',              employee.email,          50, y, 230);
    field('Telefone',           employee.phone,         290, y);
    field('Telefone Alternativo', employee.phone_secondary, 420, y);

    y += 36; hrLine(y); y += 8;

    const address = [
      employee.address,
      employee.address_number && `Nº ${employee.address_number}`,
      employee.address_comp,
    ].filter(Boolean).join(', ');

    field('Endereço',  address || '—',         50, y, 230);
    field('Bairro',    employee.neighborhood,  290, y);
    field('CEP',       employee.zip_code,      420, y);

    y += 36; hrLine(y); y += 8;

    field('Cidade',    employee.city,          50, y);
    field('Estado',    employee.state,        210, y);

    y += 40;

    // ─── Dados Profissionais ─────────────────────────────────
    y = sectionHeader('Dados Profissionais', y);

    const admDate = employee.hire_date
      ? new Date(employee.hire_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

    field('Cargo',          employee.position_name,  50, y, 180);
    field('Unidade',        employee.unit_name,      240, y, 160);
    field('Admissão',       admDate,                 410, y);

    y += 36; hrLine(y); y += 8;

    field('Supervisor',     employee.supervisor_name, 50, y, 180);
    field('Tipo Contrato',  employee.contract_type,  240, y);
    field('Jornada',        employee.work_schedule,  340, y, 200);

    y += 36; hrLine(y); y += 8;

    const salary = employee.salary
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(employee.salary)
      : '—';
    field('Salário',        salary,            50, y);

    if (employee.has_disability) {
      doc.rect(210, y - 2, 120, 18).fill('#eff6ff');
      doc.fontSize(8).fillColor(BRAND).font('Helvetica-Bold')
        .text(`PCD: ${employee.disability_type || 'Sim'}`, 214, y + 3, { width: 112 });
      doc.font('Helvetica');
    }

    y += 40;

    // ─── Dados Bancários ─────────────────────────────────────
    y = sectionHeader('Dados Bancários', y);

    field('Banco', employee.bank_code,    50, y);
    field('Agência', employee.bank_agency, 170, y);
    field('Conta', employee.bank_account, 290, y);
    field('Tipo', employee.bank_account_type, 420, y);

    y += 36; hrLine(y); y += 8;
    field('Chave PIX', employee.pix_key, 50, y, 350);

    y += 40;

    // ─── Benefícios ──────────────────────────────────────────
    if (benefits.length > 0) {
      y = sectionHeader('Benefícios Ativos', y);

      const BENEFIT_NAMES = { VR: 'Vale Refeição', VT: 'Vale Transporte', PLANO_SAUDE: 'Plano de Saúde', OUTROS: 'Outros' };

      benefits.forEach((b, i) => {
        const bx = 50 + (i % 2) * 265;
        const by = y + Math.floor(i / 2) * 30;
        doc.rect(bx, by - 2, 255, 22).fill(LIGHT);
        doc.fontSize(8).fillColor(BLACK).font('Helvetica-Bold')
          .text(BENEFIT_NAMES[b.benefit_type] || b.benefit_type, bx + 6, by + 2);
        doc.font('Helvetica').fillColor(GRAY)
          .text(b.operator || '—', bx + 6, by + 12, { width: 130 });
        if (b.value) {
          const val = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(b.value);
          doc.fillColor(SUCCESS).text(val, bx + 150, by + 2, { width: 100, align: 'right' });
        }
      });

      y += Math.ceil(benefits.length / 2) * 30 + 15;
    }

    // ─── Histórico recente ───────────────────────────────────
    if (history.length > 0) {
      // Nova página se não houver espaço
      if (y > pageH - 150) {
        doc.addPage();
        y = 50;
      }

      y = sectionHeader('Histórico Recente (Últimos 10 Eventos)', y);

      const EVENT_LABELS = {
        ADMISSAO: 'Admissão', MUDANCA_UNIDADE: 'Mudança de Unidade',
        MUDANCA_CARGO: 'Mudança de Cargo', AFASTAMENTO: 'Afastamento',
        RETORNO: 'Retorno', ADVERTENCIA: 'Advertência', ELOGIO: 'Elogio',
        DESLIGAMENTO: 'Desligamento', FERIAS: 'Férias', SOLICITACAO: 'Solicitação',
      };

      history.slice(0, 10).forEach((event) => {
        if (y > pageH - 40) { doc.addPage(); y = 50; }

        const dateStr = new Date(event.created_at).toLocaleDateString('pt-BR');
        const eventLabel = EVENT_LABELS[event.event_type] || event.event_type;

        doc.rect(50, y, pageW, 22).fill(LIGHT);
        doc.fontSize(7).fillColor(BRAND).font('Helvetica-Bold')
          .text(eventLabel, 56, y + 4, { width: 130 });
        doc.fontSize(7).fillColor(GRAY).font('Helvetica')
          .text(event.description, 190, y + 4, { width: 260 });
        doc.fillColor(GRAY)
          .text(dateStr, 460, y + 4, { width: 80, align: 'right' });

        y += 26;
      });
    }

    // ─── Rodapé ──────────────────────────────────────────────
    const footerY = doc.page.height - 50;
    doc.moveTo(50, footerY - 5).lineTo(50 + pageW, footerY - 5)
      .strokeColor('#e2e8f0').lineWidth(0.5).stroke();

    doc.fontSize(7).fillColor(GRAY)
      .text('Documento gerado automaticamente pelo Sistema de Gestão ONG. Uso interno e confidencial.',
        50, footerY, { width: pageW, align: 'center' });

    doc.end();
  });
};

/**
 * Gera PDF de relatório de presença (faltas/atrasos) de uma unidade
 */
const generateAttendancePDF = (unit, records, month) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc    = new PDFDocument({ size: 'A4', margin: 50, layout: 'landscape' });

    doc.on('data',  c => chunks.push(c));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const BRAND = '#1e40af';
    const GRAY  = '#64748b';
    const pageW = doc.page.width - 100;

    // Cabeçalho
    doc.rect(50, 50, pageW, 50).fill(BRAND);
    doc.fontSize(14).fillColor('#ffffff').font('Helvetica-Bold')
      .text('RELATÓRIO DE PRESENÇA', 70, 60);
    doc.fontSize(9).fillColor('#bfdbfe').font('Helvetica')
      .text(`${unit?.name || 'Todas as Unidades'} — ${month}`, 70, 80);

    let y = 120;

    // Cabeçalho da tabela
    const cols = [
      { label: 'Funcionário',  x: 50,  w: 200 },
      { label: 'Código',       x: 255, w: 70  },
      { label: 'Faltas',       x: 330, w: 60  },
      { label: 'Just.',        x: 395, w: 60  },
      { label: 'Atrasos',      x: 460, w: 60  },
      { label: 'Min. Atraso',  x: 525, w: 80  },
      { label: 'Status',       x: 610, w: 70  },
    ];

    doc.rect(50, y, pageW, 20).fill('#e2e8f0');
    cols.forEach(col => {
      doc.fontSize(7).fillColor('#374151').font('Helvetica-Bold')
        .text(col.label.toUpperCase(), col.x + 4, y + 6, { width: col.w });
    });
    y += 24;

    records.forEach((r, i) => {
      if (y > doc.page.height - 80) {
        doc.addPage({ layout: 'landscape' });
        y = 50;
      }

      const bgColor = i % 2 === 0 ? '#f8fafc' : '#ffffff';
      doc.rect(50, y, pageW, 18).fill(bgColor);

      const absences  = parseInt(r.absences || 0);
      const justified = parseInt(r.justified || 0);
      const late      = parseInt(r.late_arrivals || 0);
      const mins      = parseInt(r.total_minutes_late || 0);
      const total     = absences + late;
      const status    = total === 0 ? 'OK' : total <= 2 ? 'Atenção' : 'Crítico';
      const statusColor = total === 0 ? '#059669' : total <= 2 ? '#d97706' : '#dc2626';

      doc.fontSize(8).fillColor('#0f172a').font('Helvetica')
        .text(r.full_name, 54, y + 5, { width: 196 });
      doc.fillColor(GRAY)
        .text(r.employee_code || '—', 259, y + 5, { width: 66 });

      [[absences, 334], [justified, 399], [late, 464]].forEach(([val, x]) => {
        doc.fillColor(val > 0 ? '#dc2626' : '#64748b')
          .text(String(val), x, y + 5, { width: 56, align: 'center' });
      });

      doc.fillColor(mins > 0 ? '#d97706' : GRAY)
        .text(mins > 0 ? `${mins} min` : '—', 529, y + 5, { width: 76, align: 'center' });

      doc.fillColor(statusColor).font('Helvetica-Bold')
        .text(status, 614, y + 5, { width: 66, align: 'center' });

      y += 22;
    });

    // Totalizadores
    y += 5;
    doc.moveTo(50, y).lineTo(50 + pageW, y).strokeColor('#e2e8f0').lineWidth(1).stroke();
    y += 8;

    const totalAbs  = records.reduce((s, r) => s + parseInt(r.absences  || 0), 0);
    const totalJust = records.reduce((s, r) => s + parseInt(r.justified  || 0), 0);
    const totalLate = records.reduce((s, r) => s + parseInt(r.late_arrivals || 0), 0);
    const totalMins = records.reduce((s, r) => s + parseInt(r.total_minutes_late || 0), 0);

    doc.fontSize(8).fillColor('#0f172a').font('Helvetica-Bold')
      .text(`TOTAL: ${records.length} funcionários`, 54, y);

    [[totalAbs, 334], [totalJust, 399], [totalLate, 464]].forEach(([val, x]) => {
      doc.fillColor('#0f172a').text(String(val), x, y, { width: 56, align: 'center' });
    });
    doc.text(totalMins > 0 ? `${totalMins} min` : '—', 529, y, { width: 76, align: 'center' });

    // Rodapé
    const footerY = doc.page.height - 40;
    doc.fontSize(7).fillColor(GRAY).font('Helvetica')
      .text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} — ONG Sistema`,
        50, footerY, { width: pageW, align: 'center' });

    doc.end();
  });
};

module.exports = { generateEmployeePDF, generateAttendancePDF };
