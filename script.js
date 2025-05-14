document.addEventListener("DOMContentLoaded", () => {
  /* ---------- 파라미터 ---------- */
  const params   = new URLSearchParams(location.search);
  let   birthStr = params.get("b");
  if (!birthStr) return location.href = "index.html";

  /* ---------- Flatpickr ---------- */
  flatpickr("#newBirth", {
    dateFormat : "Y-m-d",
    defaultDate: birthStr,
    prevArrow  : "◀",
    nextArrow  : "▶"
  });

  /* ---------- 버튼 ---------- */
  document.getElementById("home").onclick   = () => location.href = "index.html";
  document.getElementById("recalc").onclick = () => {
    const v = document.getElementById("newBirth").value;
    if (v) location.search = "?b=" + v;    // 파라미터만 교체 후 1회 reload
  };

  const today = new Date();

  /* ========== 메인 렌더 ========= */
  function renderAll() {
    /* 1) 나이 텍스트 */
    const birthDate = new Date(birthStr);
    const diffDays  = Math.floor((today - birthDate) / 864e5);
    const months    = Math.floor(diffDays / 30);
    const weeks     = Math.floor((diffDays % 30) / 7);
    document.getElementById("ageInfo").textContent =
      `생후 ${months}개월 ${weeks}주차 (${diffDays}일)`;

    /* 2) 이벤트 계산 */
    fetch("events.json").then(r=>r.json()).then(events=>{
      const WK=864e5*7, MO=864e5*30;
      const singles=[], vacMap={};

      events.forEach(ev=>{
        if(ev.type==="vaccination") return;
        let st=new Date(birthDate), en=null;
        if(ev.week!=null){
          st=new Date(birthDate.getTime()+ev.week*WK);
          if(ev.durationWeeks) en=new Date(st.getTime()+ev.durationWeeks*WK);
        }else if(ev.month!=null){
          st=new Date(birthDate.getTime()+ev.month*MO);
        }
        singles.push({
          title:ev.title,start:st.toISOString().slice(0,10),
          end:en?en.toISOString().slice(0,10):undefined,
          color:ev.color,extendedProps:ev
        });
      });

      events.filter(e=>e.type==="vaccination").forEach(ev=>{
        const d=new Date(birthDate.getTime()+ev.month*MO)
                 .toISOString().slice(0,10);
        (vacMap[d]=vacMap[d]||[]).push(ev);
      });
      const vacs=Object.entries(vacMap).map(([d,list])=>({
        title:`${list.length}건의 접종`,start:d,color:list[0].color,
        extendedProps:{type:"vaccinationGroup",list}
      }));

      const all=[...singles,...vacs];

      /* 3) 오늘 이벤트 */
      const todayEv=all.find(e=>{
        const s=new Date(e.start), en=e.end?new Date(e.end):s;
        return today>=s&&today<=en;
      });
      const stInfo=document.getElementById("statusInfo");
      const tpInfo=document.getElementById("tipInfo");
      if(todayEv){
        const x=todayEv.extendedProps;
        let pre,st,tp;
        if(x.type==="wonder"){pre=`원더윅스 ${x.stage}단계`;st=x.description.status;tp=x.description.tip;}
        else if(x.type==="development"){pre="발달지점";st=x.description.status;tp=x.description.tip;}
        else{pre=`예방접종 (${x.list.length}차)`;st="여러 접종 일정";tp="팝업에서 상세 확인";}
        stInfo.textContent=`지금 ${pre}: ${st}`;tpInfo.textContent=`이렇게 하면 좋아요: ${tp}`;
      }else{stInfo.textContent="오늘은 특별한 이벤트가 없습니다.";tpInfo.textContent="";}

      /* 4) 달력 렌더 */
      const root=document.getElementById("calendars");
      root.innerHTML="";
      for(let off=-1;off<=4;off++){
        const div=document.createElement("div");
        div.className="month-calendar";root.append(div);
        new FullCalendar.Calendar(div,{
          initialView:"dayGridMonth",
          initialDate:new Date(today.getFullYear(),today.getMonth()+off,1)
                      .toISOString().slice(0,10),
          locale:"ko",headerToolbar:{left:"",center:"title",right:""},height:"auto",
          events:all,
          eventContent:({event})=>{
            const e=event.extendedProps;let label="";
            if(e.type==="wonder")label=`원더윅스 ${e.stage}단계`;
            else if(e.type==="development")label="발달지점";
            else if(e.type==="vaccinationGroup")label=`예방접종 (${e.list.length}차)`;
            return {html:`<div class='fc-event-label'>${label}</div>`};
          },
          eventClick:({event})=>{
            const e=event.extendedProps;
            let t,s,tp="",ex="";
            if(e.type==="vaccinationGroup"){
              t=`💉 ${e.list.length}건의 예방접종`;s=e.list.map(x=>x.title).join("\\n");
            }else{t=event.title;s=e.description.status;tp=e.description.tip;ex=e.description.example;}
            document.getElementById("mTitle").textContent=t;
            document.getElementById("mStatus").textContent=s;
            document.getElementById("mTip").textContent=tp;
            document.getElementById("mExample").textContent=ex;
            document.getElementById("eventModal").style.display="flex";
          }
        }).render();
      }

      /* 5) 다음 이벤트 텍스트 */
      const upcoming=all.filter(e=>new Date(e.start)>today)
                        .sort((a,b)=>new Date(a.start)-new Date(b.start));
      document.getElementById("nextEvent").textContent =
        upcoming[0]?`다음 ▶ ${upcoming[0].title} (${upcoming[0].start})`:"";
    });
  }

  /* 최초 실행 */
  renderAll();
  window.renderAll = renderAll;
});
