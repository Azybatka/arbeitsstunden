
import React, { useState, useMemo, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import "./App.css";

const BASE_RATE = 14.96;
const NIGHT_RATE = +(BASE_RATE * 1.25).toFixed(2);

function formatHm(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

function formatEuro(amount) {
  return amount.toFixed(2).replace(".", ",") + " €";
}

function getMonthText(date) {
  return new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function App() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [shiftType, setShiftType] = useState("late");
  const [start, setStart] = useState("");
  const [breakStart, setBreakStart] = useState("");
  const [breakEnd, setBreakEnd] = useState("");
  const [end, setEnd] = useState("");

  const [entries, setEntries] = useState(() => {
    try {
      const saved = localStorage.getItem("entries");
      return saved ? JSON.parse(saved) : [];
    } catch (err) {
      console.error("Ошибка чтения entries из localStorage", err);
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("entries", JSON.stringify(entries));
    } catch (err) {
      console.error("Ошибка записи entries в localStorage", err);
    }
  }, [entries]);

  const handleDateChange = (d) => {
    if (!d) return;
    setSelectedDate(d);
    setStart("");
    setBreakStart("");
    setBreakEnd("");
    setEnd("");
  };

  const setLateShift = () => {
    setShiftType("late");
    setStart("");
    setBreakStart("");
    setBreakEnd("");
    setEnd("");
  };

  const setNightShift = () => {
    setShiftType("night");
    setStart("");
    setBreakStart("");
    setBreakEnd("");
    setEnd("");
  };

  const saveEntry = () => {
    if (!selectedDate || !start || !end) return;

    const parseTime = (timeStr) => {
      if (!timeStr) return 0;
      const [h, m] = timeStr.split(":").map(Number);
      return h * 60 + m;
    };

    const startMin = parseTime(start);
    const endMin = parseTime(end);
    let workMinutes = endMin - startMin;
    if (workMinutes < 0) workMinutes += 24 * 60;

    const breakStartMin = parseTime(breakStart);
    const breakEndMin = parseTime(breakEnd);

    if (breakStart && breakEnd) {
      let breakMinutes = breakEndMin - breakStartMin;
      if (breakMinutes < 0) breakMinutes += 24 * 60;
      workMinutes -= breakMinutes;
    }

    const rate = shiftType === "night" ? NIGHT_RATE : BASE_RATE;
    const amount = +((workMinutes / 60) * rate).toFixed(2);
    const key = selectedDate.toISOString().slice(0, 10);

    const newEntry = {
      key,
      date: new Date(selectedDate),
      shiftType,
      start,
      breakStart,
      breakEnd,
      end,
      workMinutes,
      amount,
    };

    setEntries((prev) => {
      const withoutThis = prev.filter((e) => e.key !== key);
      return [...withoutThis, newEntry];
    });
  };

  const deleteEntry = (keyToDelete) => {
    setEntries((prev) => prev.filter((e) => e.key !== keyToDelete));
  };

  const monthEntries = useMemo(() => {
    const month = selectedDate.getMonth();
    const year = selectedDate.getFullYear();
    return entries.filter(
      (e) =>
        new Date(e.date).getMonth() === month &&
        new Date(e.date).getFullYear() === year
    );
  }, [entries, selectedDate]);

  const totalMonthMinutes = monthEntries.reduce((sum, e) => sum + e.workMinutes, 0);
  const totalLateMinutes = monthEntries.filter((e) => e.shiftType === "late").reduce((sum, e) => sum + e.workMinutes, 0);
  const totalNightMinutes = monthEntries.filter((e) => e.shiftType === "night").reduce((sum, e) => sum + e.workMinutes, 0);
  const totalAmount = monthEntries.reduce((sum, e) => sum + e.amount, 0);
  const totalLateAmount = monthEntries.filter((e) => e.shiftType === "late").reduce((sum, e) => sum + e.amount, 0);
  const totalNightAmount = monthEntries.filter((e) => e.shiftType === "night").reduce((sum, e) => sum + e.amount, 0);

  const monthText = getMonthText(selectedDate);
  const refReport = React.useRef(null);

  const generatePdf = async () => {
    if (!monthEntries.length) {
      alert("Нет смен для отчёта.");
      return;
    }

    const element = refReport.current;
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const ratio = canvas.height / canvas.width;

    const imgHeight = pdfWidth * ratio * 0.9;
    const imgWidth = pdfWidth * 0.9;

    pdf.addImage(imgData, "PNG", (pdfWidth - imgWidth) / 2, 10, imgWidth, imgHeight);
    pdf.save("arbeitsstunden.pdf");
  };

  return (
    <div className="app-shell">
      <div className="app-hero">
        <h2>Arbeitsstunden</h2>
        <p className="app-subtitle">Учет рабочих часов •
           Shyrkov Oleksandr</p>

        <div className="app-grid">
          {/* Календарь + форма */}
          <div className="card">
            <div className="card-pad">
              <DayPicker mode="single" selected={selectedDate} onSelect={handleDateChange} />
            </div>
            
            <div className="card-pad">
              <div className="section-title">📅 Вид смены</div>
              <div className="chip-row">
                <button className={`shift-chip late ${shiftType === 'late' ? 'active' : ''}`} onClick={setLateShift}>
                  🌅 Дневная смена
                </button>
                <button className={`shift-chip night ${shiftType === 'night' ? 'active' : ''}`} onClick={setNightShift}>
                  🌙 Ночная смена
                </button>
              </div>

              <div className="section-title" style={{ marginTop: 20 }}>⏰ График смены</div>
              <div className="inputs">
                <div className="field">
                  <label>Начало</label>
                  <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
                </div>
                <div className="field">
                  <label>Завершение смены</label>
                  <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
                </div>
                <div className="field">
                  <label>Перерыв с</label>
                  <input type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} />
                </div>
                <div className="field">
                  <label>Перерыв по</label>
                  <input type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} />
                </div>
              </div>

              <button className="primary-btn" onClick={saveEntry} style={{ width: '100%', marginTop: 16 }}>
                💾 Записать смену
              </button>
            </div>
          </div>

          {/* Статистика */}
          <div className="card">
            <div className="card-pad">
              <div className="section-title">📊 Итоги месяца</div>
              <div className="summary-grid">
                <div className="kpi">
                  <div className="label">Всего часов</div>
                  <div className="value">{formatHm(totalMonthMinutes)}</div>
                </div>
                <div className="kpi">
                  <div className="label">Дневные смены</div>
                  <div className="value">{formatHm(totalLateMinutes)}</div>
                </div>
                <div className="kpi">
                  <div className="label">Ночные смены</div>
                  <div className="value">{formatHm(totalNightMinutes)}</div>
                </div>
                <div className="kpi">
                  <div className="label">Итого €</div>
                  <div className="value">{formatEuro(totalAmount)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Список смен */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-pad">
          <div className="section-title">Смены за месяц ({monthEntries.length})</div>
          <div className="list-wrap">
            {monthEntries
              .slice()
              .sort((a, b) => new Date(a.date) - new Date(b.date))
              .map((e) => (
                <div key={e.key} className="shift-item">
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {new Date(e.date).toLocaleDateString("de-DE")}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      {e.shiftType === "night" ? "Ночные смены" : "Дневные смены"} смена • {e.start}–{e.end}
                    </div>
                    <div className="shift-meta">
                      Пауза: {e.breakStart || "--:--"}–{e.breakEnd || "--:--"} • {formatHm(e.workMinutes)}ч • {formatEuro(e.amount)}
                    </div>
                  </div>
                  <button className="danger-btn" onClick={() => deleteEntry(e.key)}>×</button>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* PDF отчет */}
      <div className="report-section">
        <div className="card">
          <div className="card-pad">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <div className="section-title">Официальный отчёт</div>
              <button className="primary-btn" onClick={generatePdf}>Скачать PDF</button>
            </div>
          </div>
          <div className="report-card">
            <div ref={refReport} className="report-scroll">
              <div style={{ padding: 24, fontSize: 14 }}>
                <h1 style={{ margin: 0, fontSize: 28, color: '#102033' }}>Arbeitsstunden-Nachweis</h1>
                <p style={{ margin: '16px 0', color: '#5f6b7a' }}>
                  Monat: <strong>{monthText}</strong><br />
                  Arbeitnehmer: <strong>Shyrkov Oleksandr</strong><br />
                  Arbeitgeber: <strong>Ibex Personal</strong>
                </p>

                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Datum</th>
                      <th>Art der Schicht</th>
                      <th>Beginn</th>
                      <th>Ende</th>
                      <th>Pause</th>
                      <th>Stunden</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthEntries
                      .slice()
                      .sort((a, b) => new Date(a.date) - new Date(b.date))
                      .map((e) => {
                        const typeText = e.shiftType === "night" ? "Nachtschicht" : "Spätschicht";
                        return (
                          <tr key={e.key}>
                            <td>{new Date(e.date).toLocaleDateString("de-DE")}</td>
                            <td>{typeText}</td>
                            <td>{e.start}</td>
                            <td>{e.end}</td>
                            <td>{e.breakStart || "--:--"}–{e.breakEnd || "--:--"}</td>
                            <td>{formatHm(e.workMinutes)} h</td>
                          </tr>
                        );
                      })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'right', padding: '12px 8px' }}>
                        <strong>Insgesamt im Monat</strong>
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatHm(totalMonthMinutes)} h</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;