/**
 * SprintIQ - Interactive Charts Engine
 * Builds responsive, light-themed charts with gradient fills, rounded bars
 * and brand-colored accents. Falls back to Estimated hours when a source
 * file carries no Actuals so panels never render empty.
 */

class SprintCharts {
  constructor() {
    this.instances = {};

    // Apply Afacad as the global default font for all Chart.js canvases
    if (window.Chart) {
      Chart.defaults.font.family = "'Afacad', system-ui, sans-serif";
      Chart.defaults.color = '#5f6463';
      Chart.defaults.borderColor = 'rgba(0, 0, 0, 0.06)';
    }

    this.colors = {
      primaryRed: '#e63946',
      accentRed: '#ff4d6d',
      darkRed: '#a4161a',
      lightRed: '#ff758f',
      green: '#2ec4b6',
      amber: '#ffb703',
      red: '#e63946',
      blue: '#4361ee',
      slate: '#94a3b8',
      graphiteDark: '#ffffff',
      graphiteCard: '#ffffff',
      graphiteBorder: '#e6e6e1',
      textPrimary: '#252829',
      textMuted: '#6b6f6e',
      chartPalette: [
        '#e63946', '#2ec4b6', '#ffb703', '#4361ee', '#7209b7',
        '#f72585', '#4cc9f0', '#06d6a0', '#118ab2', '#073b4c'
      ]
    };
  }

  destroyChart(id) {
    if (this.instances[id]) {
      this.instances[id].destroy();
      delete this.instances[id];
    }
  }

  destroyAll() {
    Object.keys(this.instances).forEach(id => this.destroyChart(id));
  }

  _alpha(hex, a) {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  ragColor(rag) {
    return rag === 'GREEN' ? this.colors.green : (rag === 'AMBER' ? this.colors.amber : this.colors.red);
  }

  getDefaultOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700, easing: 'easeOutQuart' },
      plugins: {
        legend: {
          labels: {
            color: this.colors.textMuted,
            font: { family: 'Afacad, system-ui, sans-serif', size: 12 },
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 14
          }
        },
        tooltip: {
          backgroundColor: '#252829',
          titleColor: '#ffffff',
          bodyColor: '#e6e6e1',
          borderColor: 'rgba(255,255,255,0.12)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          titleFont: { size: 12, weight: '700' },
          bodyFont: { size: 12 },
          boxPadding: 5
        }
      },
      scales: {
        x: {
          ticks: { color: this.colors.textMuted, font: { size: 11 } },
          grid: { display: false },
          border: { color: 'rgba(0,0,0,0.14)' }
        },
        y: {
          ticks: { color: this.colors.textMuted, font: { size: 11 } },
          grid: { color: 'rgba(0, 0, 0, 0.05)' },
          border: { display: false },
          beginAtZero: true
        }
      }
    };
  }

  /**
   * Plugin: draws a centered metric inside doughnut charts.
   */
  _centerTextPlugin(lines) {
    return {
      id: 'siqCenterText',
      afterDraw(chart) {
        const meta = chart.getDatasetMeta(0);
        if (!meta || !meta.data || !meta.data[0]) return;
        const { x, y } = meta.data[0];
        const c = chart.ctx;
        c.save();
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        lines.forEach((ln, i) => {
          c.font = `${ln.weight || '700'} ${ln.size}px Afacad, system-ui, sans-serif`;
          c.fillStyle = ln.color;
          c.fillText(ln.text, x, y + ln.dy);
        });
        c.restore();
      }
    };
  }

  /**
   * Render Sprint Task Status Donut Chart
   */
  renderTaskStatusDonut(canvasId, metrics) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const statusColors = ['#2ec4b6', '#4361ee', '#ffb703', '#e63946', '#64748b'];

    this.instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Completed', 'In Progress', 'Pending', 'Blocked', 'Cancelled'],
        datasets: [{
          data: [metrics.completed, metrics.inProgress, metrics.pending, metrics.blocked, metrics.cancelled],
          backgroundColor: statusColors.map(c => this._alpha(c, 0.9)),
          hoverBackgroundColor: statusColors,
          borderColor: '#ffffff',
          borderWidth: 3,
          borderRadius: 6,
          spacing: 2,
          hoverOffset: 10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { animateRotate: true, duration: 800, easing: 'easeOutQuart' },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: this.colors.textMuted,
              boxWidth: 8,
              padding: 12,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: '#252829',
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (c) => ` ${c.label}: ${c.raw} tasks (${Math.round((c.raw / (metrics.totalTasks || 1)) * 100)}%)`
            }
          }
        },
        cutout: '68%'
      },
      plugins: [this._centerTextPlugin([
        { text: `${metrics.completionPct}%`, size: 30, color: '#252829', dy: -10 },
        { text: 'DELIVERED', size: 11, weight: '600', color: '#9aa09e', dy: 16 }
      ])]
    });
  }

  /**
   * Render Employee Workload Est vs Act Bar Chart
   */
  renderEmployeeWorkloadBar(canvasId, employees) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = employees.map(e => e.name.split(' ')[0]);
    const estData = employees.map(e => e.estHours);
    const actData = employees.map(e => e.actHours);
    const noActuals = actData.every(v => !v);

    // No actuals in the source: draw a single Estimated series colored by
    // each employee's RAG so the panel still communicates per-person health
    // without plotting a misleading empty axis.
    const datasets = [{
      label: 'Estimated (hrs)',
      data: estData,
      backgroundColor: noActuals
        ? employees.map(e => this._alpha(this.ragColor(e.rag), 0.8))
        : 'rgba(148, 163, 184, 0.6)',
      hoverBackgroundColor: noActuals
        ? employees.map(e => this.ragColor(e.rag))
        : '#64748b',
      borderRadius: 7,
      borderSkipped: false,
      barPercentage: 0.75,
      categoryPercentage: 0.55
    }];

    if (!noActuals) {
      datasets.push({
        label: 'Actual Spent (hrs)',
        data: actData,
        backgroundColor: employees.map(e => this._alpha(this.ragColor(e.rag), 0.85)),
        hoverBackgroundColor: employees.map(e => this.ragColor(e.rag)),
        borderRadius: 7,
        borderSkipped: false,
        barPercentage: 0.75,
        categoryPercentage: 0.55
      });
    }

    const opts = this.getDefaultOptions();
    opts.plugins.legend.position = 'top';
    if (noActuals) {
      opts.plugins.tooltip.callbacks = {
        label: (c) => ` ${c.dataset.label}: ${c.raw}h`,
        afterLabel: (c) => {
          const e = employees[c.dataIndex];
          return e ? `RAG: ${e.rag} (${e.score}/100) · ${e.completed}/${e.totalAssigned} tasks` : '';
        }
      };
    }

    this.instances[canvasId] = new Chart(ctx, { type: 'bar', data: { labels, datasets }, options: opts });
  }

  /**
   * Render Priority vs Hours Chart
   */
  renderPriorityChart(canvasId, priorityData) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const priorityColors = { High: '#e63946', Medium: '#ffb703', Low: '#2ec4b6' };
    const labels = priorityData.map(p => p.priority);
    const est = priorityData.map(p => p.estHours);
    const act = priorityData.map(p => p.actHours);
    const noActuals = act.every(v => !v);

    const datasets = [{
      label: noActuals ? 'Planned Effort (hrs)' : 'Est (hrs)',
      data: est,
      backgroundColor: priorityData.map(p => this._alpha(priorityColors[p.priority] || '#94a3b8', 0.85)),
      hoverBackgroundColor: priorityData.map(p => priorityColors[p.priority] || '#64748b'),
      borderRadius: 8,
      borderSkipped: false,
      barPercentage: 0.6,
      categoryPercentage: 0.6
    }];

    if (!noActuals) {
      datasets.push({
        label: 'Act (hrs)',
        data: act,
        backgroundColor: priorityData.map(p => this._alpha(priorityColors[p.priority] || '#94a3b8', 0.45)),
        borderColor: priorityData.map(p => priorityColors[p.priority] || '#94a3b8'),
        borderWidth: 1.5,
        borderRadius: 8,
        borderSkipped: false,
        barPercentage: 0.6,
        categoryPercentage: 0.6
      });
    }

    const opts = this.getDefaultOptions();
    opts.plugins.legend.position = 'top';
    opts.plugins.tooltip.callbacks = {
      label: (c) => ` ${c.dataset.label}: ${c.raw}h`,
      afterLabel: (c) => {
        const p = priorityData[c.dataIndex];
        return p ? `${p.completedCount}/${p.taskCount} tasks completed (${p.completionPct}%)` : '';
      }
    };

    this.instances[canvasId] = new Chart(ctx, { type: 'bar', data: { labels, datasets }, options: opts });
  }

  /**
   * Render Project Workload Horizontal Bar Chart.
   * Shows Estimated vs Actual effort — stays populated even when the
   * imported file has no logged hours.
   */
  renderProjectChart(canvasId, projects) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const topProjects = [...projects]
      .sort((a, b) => (b.actHours + b.estHours) - (a.actHours + a.estHours))
      .slice(0, 8);
    const labels = topProjects.map(p => p.name.length > 20 ? p.name.slice(0, 18) + '…' : p.name);
    const actData = topProjects.map(p => p.actHours);
    const estData = topProjects.map(p => p.estHours);
    const noActuals = actData.every(v => !v);

    const datasets = [];
    if (!noActuals) {
      datasets.push({
        label: 'Actual Effort (hrs)',
        data: actData,
        backgroundColor: topProjects.map(p => this._alpha(this.ragColor(p.rag), 0.85)),
        borderRadius: 6,
        borderSkipped: false,
        barPercentage: 0.7,
        categoryPercentage: 0.62
      });
    }
    // Bold brand palette — 4 colors max, cycled across projects
    const boldPalette = ['#e63946', '#2ec4b6', '#ffb703', '#4361ee'];
    datasets.push({
      label: noActuals ? 'Planned Effort (hrs)' : 'Estimated (hrs)',
      data: estData,
      backgroundColor: topProjects.map((p, i) => boldPalette[i % boldPalette.length]),
      borderRadius: 6,
      borderSkipped: false,
      barPercentage: 0.7,
      categoryPercentage: 0.62
    });

    const opts = this.getDefaultOptions();
    opts.indexAxis = 'y';
    opts.plugins.legend.display = !noActuals;
    opts.plugins.legend.position = 'top';
    opts.scales.x.grid = { color: 'rgba(0,0,0,0.05)' };
    opts.scales.x.border = { display: false };
    opts.scales.y.grid = { display: false };
    opts.scales.y.border = { color: 'rgba(0,0,0,0.14)' };
    opts.plugins.tooltip.callbacks = {
      label: (c) => ` ${c.dataset.label}: ${c.raw}h`,
      afterLabel: (c) => {
        const p = topProjects[c.dataIndex];
        return p ? `${p.completedCount}/${p.taskCount} tasks done · ${p.rag}` : '';
      }
    };

    this.instances[canvasId] = new Chart(ctx, { type: 'bar', data: { labels, datasets }, options: opts });
  }

  /**
   * Render Multi-Sprint Trend Comparison Chart
   */
  renderSprintTrendChart(canvasId, sprintHistory) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = sprintHistory.map(s => s.name.replace(/\(.*?\)/g, '').trim().slice(0, 18));
    const completionData = sprintHistory.map(s => s.metrics.completionPct);
    const efficiencyData = sprintHistory.map(s => s.metrics.efficiencyPct);
    const actHoursData = sprintHistory.map(s => s.metrics.totalAct);

    const opts = this.getDefaultOptions();
    opts.scales.y = {
      type: 'linear',
      position: 'left',
      min: 0,
      max: 120,
      ticks: { color: this.colors.textMuted, callback: (v) => `${v}%` },
      grid: { color: 'rgba(0, 0, 0, 0.05)' },
      border: { display: false }
    };
    opts.scales.y1 = {
      type: 'linear',
      position: 'right',
      ticks: { color: '#e63946', callback: (v) => `${v}h` },
      grid: { drawOnChartArea: false },
      border: { display: false }
    };

    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Completion Rate (%)',
            data: completionData,
            borderColor: '#2ec4b6',
            backgroundColor: 'rgba(46, 196, 182, 0.12)',
            tension: 0.4,
            fill: true,
            borderWidth: 2.5,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#2ec4b6',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            yAxisID: 'y'
          },
          {
            label: 'Efficiency (%)',
            data: efficiencyData,
            borderColor: '#ffb703',
            backgroundColor: 'transparent',
            borderDash: [6, 5],
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: '#ffb703',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            yAxisID: 'y'
          },
          {
            label: 'Total Actual Hours',
            data: actHoursData,
            borderColor: '#e63946',
            backgroundColor: 'transparent',
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: '#e63946',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            yAxisID: 'y1'
          }
        ]
      },
      options: opts
    });
  }

  /**
   * Render Drilldown Chart for individual employee
   */
  renderEmployeeDetailChart(canvasId, employee) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = employee.tasks.map(t => t.item.length > 22 ? t.item.slice(0, 20) + '…' : t.item);
    const est = employee.tasks.map(t => t.est);
    const act = employee.tasks.map(t => t.act);
    const noActuals = act.every(v => !v);

    const statusColor = (t) => {
      const s = (t.status || '').toLowerCase();
      if (s === 'completed') return '#2ec4b6';
      if (s === 'blocked') return '#e63946';
      if (s === 'in progress' || s === 'in_progress') return '#4361ee';
      if (s === 'cancelled') return '#64748b';
      return '#ffb703';
    };

    const datasets = [{
      label: 'Est (hrs)',
      data: est,
      backgroundColor: employee.tasks.map(t => this._alpha(statusColor(t), 0.85)),
      hoverBackgroundColor: employee.tasks.map(t => statusColor(t)),
      borderRadius: 6,
      borderSkipped: false,
      barPercentage: 0.7,
      categoryPercentage: 0.6
    }];
    if (!noActuals) {
      datasets.push({
        label: 'Act (hrs)',
        data: act,
        backgroundColor: this._alpha('#e63946', 0.85),
        borderRadius: 6,
        borderSkipped: false,
        barPercentage: 0.7,
        categoryPercentage: 0.6
      });
    }

    const opts = this.getDefaultOptions();
    opts.plugins.legend.position = 'top';
    opts.plugins.tooltip.callbacks = {
      title: (items) => {
        const t = employee.tasks[items[0].dataIndex];
        return t ? t.item : '';
      },
      label: (c) => ` ${c.dataset.label}: ${c.raw}h`,
      afterLabel: (c) => {
        const t = employee.tasks[c.dataIndex];
        return t ? `Status: ${t.status} · ${t.priority}` : '';
      }
    };

    this.instances[canvasId] = new Chart(ctx, { type: 'bar', data: { labels, datasets }, options: opts });
  }
}

window.SprintCharts = new SprintCharts();
