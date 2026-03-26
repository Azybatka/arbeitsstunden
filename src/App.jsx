import React, { useState, useMemo } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas"; // npm install jspdf html2canvas

const BASE_RATE = 14.96; // дневная ставка
const NIGHT_RATE = +(BASE_RATE * 1.25).toFixed(2); // +25% → 18.70 €/ч

function formatHm(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

function formatEuro(amount) {
  return amount.toFixed(2).replace(".", ",") + " €";
}

function App() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [shiftType, setShiftType] = useState("late"); // late | night

  const [start, setStart] = useState("");
  const [breakStart, setBreakStart] = useState("");
  const [breakEnd, setBreakEnd] = useState("");
  const [end, setEnd] = useState("");

  const [entries, setEntries] = useState([]);

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

    const startMin = (start || "00:00").split(":").map(Number).reduce((h, m) => h * 60 + m, 0);
    const endMin = (end || "00:00").split(":").map(Number).reduce((h, m) => h * 60 + m, 0);

    let workMinutes = endMin - startMin;
    if (workMinutes < 0) workMinutes += 24 * 60;

    const breakStartMin = (breakStart || "00:00").split(":").map(Number).reduce((h, m) => h * 60 + m, 0);
    const breakEndMin = (breakEnd || "00:00").split(":").map(Number).reduce((h, m) => h * 60 + m, 0);

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
      (e) => e.date.getMonth() === month && e.date.getFullYear() === year
    );
  }, [entries, selectedDate]);

  const totalMonthMinutes = monthEntries.reduce(
    (sum, e) => sum + e.workMinutes,
    0
  );
  const totalLateMinutes = monthEntries
    .filter((e) => e.shiftType === "late")
    .reduce((sum, e) => sum + e.workMinutes, 0);
  const totalNightMinutes = monthEntries
    .filter((e) => e.shiftType === "night")
    .reduce((sum, e) => sum + e.workMinutes, 0);

  const totalAmount = monthEntries.reduce((sum, e) => sum + e.amount, 0);
  const totalLateAmount = monthEntries
    .filter((e) => e.shiftType === "late")
    .reduce((sum, e) => sum + e.amount, 0);
  const totalNightAmount = monthEntries
    .filter((e) => e.shiftType === "night")
    .reduce((sum, e) => sum + e.amount, 0);

  // PDF-отчёт
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

    pdf.addImage(
      imgData,
      "PNG",
      (pdfWidth - imgWidth) / 2,
      10,
      imgWidth,
      imgHeight
    );
    pdf.save("arbeitsstunden.pdf");
  };

  const monthText = new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
  }).format(selectedDate);

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 16 }}>
      <h2>Учет рабочих часов</h2>

      <DayPicker
        mode="single"
        selected={selectedDate}
        onSelect={handleDateChange}
      />

      <div style={{ marginTop: 12 }}>
        <span style={{ marginRight: 8 }}>Тип смены:</span>
        <button
          onClick={setLateShift}
          style={{
            marginRight: 8,
            border: "1px solid #aaa",
            borderRadius: 4,
            padding: "4px 8px",
            background: shiftType === "late" ? "rgb(78, 78, 211)" : "#38b914",
          }}
        >
          Поздняя
        </button>
        <button
          onClick={setNightShift}
          style={{
            border: "1px solid #aaa",
            borderRadius: 4,
            padding: "4px 8px",
            background: shiftType === "night" ? "#463d3d" : "#481010",
          }}
        >
          Ночная
        </button>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginTop: 16,
        }}
      >
        <label>
          Начало:
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>

        <label>
          Пауза начало:
          <input
            type="time"
            value={breakStart}
            onChange={(e) => setBreakStart(e.target.value)}
          />
        </label>

        <label>
          Пауза конец:
          <input
            type="time"
            value={breakEnd}
            onChange={(e) => setBreakEnd(e.target.value)}
          />
        </label>

        <label>
          Конец:
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>

        <button
          onClick={saveEntry}
          style={{ marginTop: 12, padding: "8px 16px", borderRadius: 4 }}
        >
          Сохранить смену
        </button>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 8,
          border: "1px solid #ccc",
          borderRadius: 4,
          display: "inline-block",
        }}
      >
        <div>Всего за месяц: {formatHm(totalMonthMinutes)} ч</div>
        <div>
          Поздние: {formatHm(totalLateMinutes)} ч ({formatEuro(totalLateAmount)})
        </div>
        <div>
          Ночные (+25%): {formatHm(totalNightMinutes)} ч (
          {formatEuro(totalNightAmount)})
        </div>
        <div>Итого денег: {formatEuro(totalAmount)}</div>
      </div>

      <h3 style={{ marginTop: 16 }}>Смены</h3>
      <ul style={{ paddingLeft: 16 }}>
        {monthEntries
          .slice()
          .sort((a, b) => a.date - b.date)
          .map((e) => (
            <li
              key={e.key}
              style={{
                border: "1px solid #ccc",
                borderRadius: 4,
                padding: 6,
                marginBottom: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                listStyle: "none",
              }}
            >
              <div>
                {e.date.toLocaleDateString("de-DE")} —{" "}
                {e.shiftType === "night" ? "ночная" : "поздняя"},{" "}
                {e.start}–{e.end}, пауза {e.breakStart || "--:--"}–
                {e.breakEnd || "--:--"} (
                {formatHm(e.workMinutes)} ч, {formatEuro(e.amount)})
              </div>
              <button
                onClick={() => deleteEntry(e.key)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 18,
                  cursor: "pointer",
                  color: "red",
                  marginLeft: 8,
                }}
              >
                ×
              </button>
            </li>
          ))}
      </ul>

      {/* ========= ОТЧЁТ ДЛЯ РАБОТОДАТЕЛЯ (на немецком, без денег) ========= */}
      <h3 style={{ marginTop: 32 }}>Отчёт для работодателя (для PDF)</h3>

      <button
        onClick={generatePdf}
        style={{
          marginBottom: 16,
          padding: "8px 16px",
          border: "1px solid #333",
          borderRadius: 4,
          background: "#1e90ff",
          color: "white",
        }}
      >
        Скачать PDF
      </button>

      <div
        id="report"
        ref={refReport}
        style={{
          width: "210mm",
          minHeight: "297mm",
          fontSize: 14,
          lineHeight: 1.5,
          padding: "16px",
          border: "1px solid #ddd",
          borderRadius: 4,
          background: "white",
        }}
      >
        <h1>Arbeitsstunden-Nachweis</h1>
        <p>
          Monat: <strong>{monthText}</strong>
          <br />
          Arbeitnehmer: <strong>Shyrkov Oleksandr</strong>
          <br />
          Arbeitgeber: <strong>Ibex Personal</strong>
        </p>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: 16,
          }}
        >
          <thead>
            <tr style={{ background: "#f0f0f0" }}>
              <th style={{ border: "1px solid #999", padding: "6px 8px" }}>
                Datum
              </th>
              <th style={{ border: "1px solid #999", padding: "6px 8px" }}>
                Art der Schicht
              </th>
              <th style={{ border: "1px solid #999", padding: "6px 8px" }}>
                Beginn
              </th>
              <th style={{ border: "1px solid #999", padding: "6px 8px" }}>
                Ende
              </th>
              <th style={{ border: "1px solid #999", padding: "6px 8px" }}>
                Pause
              </th>
              <th style={{ border: "1px solid #999", padding: "6px 8px" }}>
                Stunden
              </th>
            </tr>
          </thead>
          <tbody>
            {monthEntries
              .slice()
              .sort((a, b) => a.date - b.date)
              .map((e) => {
                const typeText =
                  e.shiftType === "night" ? "Nachtschicht" : "Spätschicht";

                return (
                  <tr key={e.key}>
                    <td style={{ border: "1px solid #999", padding: "6px 8px" }}>
                      {e.date.toLocaleDateString("de-DE")}
                    </td>
                    <td style={{ border: "1px solid #999", padding: "6px 8px" }}>
                      {typeText}
                    </td>
                    <td style={{ border: "1px solid #999", padding: "6px 8px" }}>
                      {e.start}
                    </td>
                    <td style={{ border: "1px solid #999", padding: "6px 8px" }}>
                      {e.end}
                    </td>
                    <td style={{ border: "1px solid #999", padding: "6px 8px" }}>
                      {e.breakStart || "--:--"}–{e.breakEnd || "--:--"}
                    </td>
                    <td style={{ border: "1px solid #999", padding: "6px 8px" }}>
                      {formatHm(e.workMinutes)} h
                    </td>
                  </tr>
                );
              })}
          </tbody>
          <tfoot>
            <tr style={{ background: "#f0f0f0" }}>
              <td colSpan={5} style={{ padding: "6px 8px" }}>
                <strong>Insgesamt im Monat</strong>
              </td>
              <td style={{ border: "1px solid #999", padding: "6px 8px" }}>
                {formatHm(totalMonthMinutes)} h
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default App;
