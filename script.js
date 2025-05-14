document.addEventListener("DOMContentLoaded", () => {
  /* ---------- 기본 파라미터 처리 ---------- */
  const params   = new URLSearchParams(location.search);
  let   birthStr = params.get("b");
  if (!birthStr) return location.href = "index.html";   // 파라미터 없으면 홈으로

  /* ---------- Flatpickr 세팅 ---------- */
  flatpickr("#newBirth", {
    dateFormat : "Y-m-d",
    defaultDate: birthStr,
    prevArrow  : "◀",
    nextArrow  : "▶"
  });

  /* ---------- 버튼 네비 ---------- */
  home.onclick   = () => location.href = "index.html";
  recalc.onclick = () => {
    const v = newBirth.value;
    if (v) location.search = "?b=" + v;   // URL 파라미터만 갱신 → 1회 새로고침
  };

  const today = new Date();

  /* ====================================================== */
  /*                메인 계산 & 달력 그리기                */
  /* ====================================================== */
  function renderAll () {

    /* 1) 나이 계산 */
    const birthDate = new Date(birthStr);
    const diffDays  = Math.floor((today - birthDate) / 864e5);     // ms → 일
    const months    = Math.floor(diffDays / 30);
    const weeks     = Math.floor((diffDays % 30) / 7);
    ageInfo.textContent = `생후 ${months}개월 ${weeks}주차 (${diffDays}일)`;

    /* 2) 데이터 불러오기 */
    fetch("events.json")
      .then(r => r.json())
      .then(events => {

        const WK = 864e5 * 7;    // 주
        const MO = 864e5 * 30;   // 월 (대략)

        /* -------------------------------------------------- */
        /*   2-1) 원더·발달 단일 이벤트 계산                  */
        /* -------------------------------------------------- */
        const singleEvents = [];
        events.forEach(ev => {
          if (ev.type === "vaccination") return;   // 접종은 뒤에서 처리

          let st = new Date(birthDate);
          let en = null;

          if (ev.week != null) {
            st = new Date(birthDate.getTime() + ev.week * WK);
            if (ev.durationWeeks)
              en = new Date(st.getTime() + ev.durationWeeks * WK);
          } else if (ev.month != null) {
            st = new Date(birthDate.getTime() + ev.month * MO);
          }

          singleEvents.push({
            title : ev.title,
            start : st.toISOString().slice(0, 10),
            end   : en ? en.toISOString().slice(0, 10) : undefined,
            color : ev.color,
            extendedProps : ev
          });
        });

        /* -------------------------------------------------- */
        /*   2-2) 예방접종 묶음 이벤트 계산                   */
        /* -------------------------------------------------- */
        const vacMap = {};
        events.filter(e => e.type === "vaccination")
              .forEach(ev => {
                const st = new Date(birthDate.getTime() + ev.month * MO);
                const d  = st.toISOString().slice(0, 10);
                (vacMap[d] = vacMap[d] || []).push(ev);
              });

        const vacEvents = Object.entries(vacMap).map(([d, list]) => ({
          title : `${list.length}건의 접종`,
          start : d,
          color : list[0].color,
          extendedProps : { type: "vaccinationGroup", list }
        }));

        /* 전체 배열 */
        const allEvents = [...singleEvents, ...vacEvents];

        /* -------------------------------------------------- */
        /*   3) 오늘 이벤트 요약                             */
        /* -------------------------------------------------- */
        const todayEvent = allEvents.find(e => {
          const s = new Date(e.start);
          const en = e.end ? new Date(e.end) : s;
          return today >= s && today <= en;
        });

        if (todayEvent) {
          const x = todayEvent.extendedProps;
          let pre, st, tp;

          if (x.type === "wonder") {
            pre = `원더윅스 ${x.stage}단계`;
            st  = x.description.status;
            tp  = x.description.tip;
          } else if (x.type === "development") {
            pre = "발달지점";
            st  = x.description.status;
            tp  = x.description.tip;
          } else {
            pre = `예방접종 (${x.list.length}차)`;
            st  = "여러 접종 일정이 있습니다.";
            tp  = "팝업에서 세부 항목을 확인하세요.";
          }

          statusInfo.textContent = `지금 ${pre}: ${st}`;
          tipInfo.textContent    = `이렇게 하면 좋아요: ${tp}`;
        } else {
          statusInfo.textContent = "오늘은 특별한 이벤트가 없습니다.";
          tipInfo.textContent    = "";
        }

        /* -------------------------------------------------- */
        /*   4) 칼렌더 6개월 렌더                             */
        /* -------------------------------------------------- */
        calendars.innerHTML = "";
        for (let off = -1; off <= 4; off++) {
          const div = document.createElement("div");
          div.className = "month-calendar";
          calendars.append(div);

          const md = new Date(today.getFullYear(),
                              today.getMonth() + off, 1);

          new FullCalendar.Calendar(div, {
            initialView  : "dayGridMonth",
            initialDate  : md.toISOString().slice(0, 10),
            locale       : "ko",
            headerToolbar: { left: "", center: "title", right: "" },
            height       : "auto",
            events       : allEvents,

            eventContent : ({ event }) => {
              const e = event.extendedProps;
              let label = "";
              if (e.type === "wonder")
                   label = `원더윅스 ${e.stage}단계`;
              else if (e.type === "development")
                   label = "발달지점";
              else if (e.type === "vaccinationGroup")
                   label = `예방접종 (${e.list.length}차)`;
              return { html: `<div class='fc-event-label'>${label}</div>` };
            },

            eventClick : ({ event }) => {
              const e = event.extendedProps;
              let t, s, tp = "", ex = "";

              if (e.type === "vaccinationGroup") {
                t = `💉 ${e.list.length}건의 예방접종`;
                s = e.list.map(x => x.title).join("\\n");
              } else {
                t  = event.title;
                s  = e.description.status;
                tp = e.description.tip;
                ex = e.description.example;
              }

              mTitle.textContent   = t;
              mStatus.textContent  = s;
              mTip.textContent     = tp;
              mExample.textContent = ex;

              eventModal.style.display = "flex";
            }
          }).render();
        }

        /* -------------------------------------------------- */
        /*   5) 다음 이벤트 안내                             */
        /* -------------------------------------------------- */
        const upcoming = allEvents
          .filter(e => new Date(e.start) > today)
          .sort((a, b) => new Date(a.start) - new Date(b.start));

        let summary = "";
        if (upcoming[0])
          summary = `다음 ▶ ${upcoming[0].title} (${upcoming[0].start})`;
        nextEvent.textContent = summary;
      });
  }

  /* 최초 실행 */
  renderAll();
  window.renderAll = renderAll;   // 외부(버튼)에서 호출 가능
});
