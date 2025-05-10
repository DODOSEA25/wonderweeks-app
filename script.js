document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(location.search);
  let birthStr = params.get("b");
  if (!birthStr) return location.href = "index.html";

  // Flatpickr 세팅 (재계산 입력)
  flatpickr("#newBirthdate", {
    dateFormat: "Y-m-d",
    defaultDate: birthStr,
    prevArrow: "◀", 
    nextArrow: "▶"
  });

  document.getElementById("homeBtn")
    .addEventListener("click", () => location.href = "index.html");
  document.getElementById("recalcBtn")
    .addEventListener("click", () => {
      const v = document.getElementById("newBirthdate").value;
      if (v) {
        birthStr = v;
        renderAll();
      }
    });

  const today = new Date();

  function renderAll() {
    const birthDate = new Date(birthStr);
    const diffDays = Math.floor((today - birthDate) / (1000*60*60*24));
    const months   = Math.floor(diffDays / 30);
    const weeks    = Math.floor((diffDays % 30) / 7);
    document.getElementById("ageInfo").textContent =
      `생후 ${months}개월 ${weeks}주차 (${diffDays}일)`;

    fetch("events.json")
      .then(res => res.json())
      .then(events => {
        const wk = 1000*60*60*24*7;
        const mo = 1000*60*60*24*30;
        const singleEvents = [];
        events.forEach(ev => {
          if (ev.type === "vaccination") return;
          let st = new Date(birthDate), en = null;
          if (ev.week != null) {
            st = new Date(birthDate.getTime() + ev.week * wk);
            if (ev.durationWeeks) {
              en = new Date(st.getTime() + ev.durationWeeks * wk);
            }
          } else if (ev.month != null) {
            st = new Date(birthDate.getTime() + ev.month * mo);
          }
          singleEvents.push({
            title: ev.title,
            start: st.toISOString().slice(0,10),
            end:   en ? en.toISOString().slice(0,10) : undefined,
            color: ev.color,
            extendedProps: ev
          });
        });

        const vacMap = {};
        events.filter(e => e.type === "vaccination")
          .forEach(ev => {
            const st = new Date(birthDate.getTime() + ev.month * mo);
            const d  = st.toISOString().slice(0,10);
            vacMap[d] = vacMap[d] || [];
            vacMap[d].push(ev);
          });
        const vacEvents = Object.entries(vacMap).map(([d,list]) => ({
          title: `${list.length}건의 접종`,
          start: d,
          color: list[0].color,
          extendedProps: { type: "vaccinationGroup", list }
        }));

        const allEvents = [...singleEvents, ...vacEvents];

        // 오늘 이벤트 요약
        const todayEv = allEvents.find(e => {
          const s = new Date(e.start);
          const en= e.end ? new Date(e.end) : s;
          return today >= s && today <= en;
        });
        if (todayEv) {
          const ev = todayEv.extendedProps;
          let prefix, status, tip;
          if (ev.type === "wonder") {
            prefix = `원더윅스 ${ev.stage}단계`;
            status = ev.description.status;
            tip    = ev.description.tip;
          } else if (ev.type === "development") {
            prefix = `발달지점`;
            status = ev.description.status;
            tip    = ev.description.tip;
          } else {
            prefix = `예방접종 (${ev.list.length}차)`;
            status = "여러 접종 일정이 있습니다.";
            tip    = "팝업에서 세부 접종 항목을 확인하세요.";
          }
          document.getElementById("statusInfo").textContent =
            `지금 ${prefix}: ${status}`;
          document.getElementById("tipInfo").textContent =
            `이렇게 하면 좋아요: ${tip}`;
        } else {
          document.getElementById("statusInfo").textContent =
            "오늘은 특별한 이벤트가 없습니다.";
          document.getElementById("tipInfo").textContent = "";
        }

        // 달력 6개월 렌더
        const calRoot = document.getElementById("calendars");
        calRoot.innerHTML = "";
        for (let offset = -1; offset <= 4; offset++) {
          const div = document.createElement("div");
          div.className = "month-calendar";
          calRoot.append(div);

          const md = new Date(today.getFullYear(), today.getMonth() + offset, 1);
          new FullCalendar.Calendar(div, {
            initialView: "dayGridMonth",
            initialDate: md.toISOString().slice(0,10),
            locale: "ko",
            headerToolbar: { left:"", center:"title", right:"" },
            height: "auto",
            events: allEvents,
            eventContent: info => {
              const e = info.event.extendedProps;
              let label = "";
              if (e.type === "wonder") {
                label = `원더윅스 ${e.stage}단계`;
              } else if (e.type === "development") {
                label = `발달지점`;
              } else if (e.type === "vaccinationGroup") {
                label = `예방접종 (${e.list.length}차)`;
              }
              return { html: `<div class="fc-event-label">${label}</div>` };
            },
            eventClick: info => {
              const e = info.event.extendedProps;
              let title, status, tip = "", example = "";
              if (e.type === "vaccinationGroup") {
                title  = `💉 ${e.list.length}건의 예방접종`;
                status = e.list.map(x => x.title).join("\n");
              } else {
                title   = info.event.title;
                status  = e.description.status;
                tip     = e.description.tip;
                example = e.description.example;
              }
              document.getElementById("modalTitle").textContent   = title;
              document.getElementById("modalStatus").textContent  = status;
              document.getElementById("modalTip").textContent     = tip;
              document.getElementById("modalExample").textContent = example;
              document.getElementById("eventModal").style.display = "flex";
            }
          }).render();
        }

        // nextEvent
        const upcoming = allEvents
          .filter(e => new Date(e.start) > today)
          .sort((a,b) => new Date(a.start) - new Date(b.start));
        const wonderEnds = allEvents
          .filter(e => e.extendedProps.type === "wonder")
          .map(e => ({ ev: e, endDate: e.end ? new Date(e.end) : new Date(e.start) }));
        const lastWonder = wonderEnds.reduce((acc,cur) =>
          cur.endDate > acc.endDate ? cur : acc
        ,{ ev:null,endDate:new Date(0) });

        let summary = "";
        if (upcoming[0]) {
          summary += `다음 ▶ ${upcoming[0].title} (${upcoming[0].start})`;
        }
        if (lastWonder.ev) {
          const stg = lastWonder.ev.extendedProps.stage;
          const ed  = lastWonder.endDate.toISOString().slice(0,10);
          summary += (summary ? " | " : "") +
                     `마지막 ▶ 원더윅스 ${stg}단계 종료 (${ed})`;
        }
        document.getElementById("nextEvent").textContent = summary;
      });
  }

  // 초기 렌더
  renderAll();
});