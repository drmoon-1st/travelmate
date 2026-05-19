const SUPABASE_URL = "https://fnwlvhjovayghwxuagkp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZud2x2aGpvdmF5Z2h3eHVhZ2twIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTE5MzYsImV4cCI6MjA5NDc4NzkzNn0.h7OgGksNauSEd5imj3ojS82T3AWs-zGLinszg_GuBh8";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

let DESTINATIONS = {};
let CURRENT_GROUPS = [];
let currentGroupId = null;

(function () {
  // ---------- Modal ----------
  function openSignin() {
    const modal = document.getElementById("signinModal");
    if (modal) modal.style.display = "block";
  }

  function closeSignin() {
    const modal = document.getElementById("signinModal");
    if (modal) modal.style.display = "none";
  }

  function openSignup() {
    const modal = document.getElementById("signupModal");
    if (modal) modal.style.display = "block";
  }

  function closeSignup() {
    const modal = document.getElementById("signupModal");
    if (modal) modal.style.display = "none";
  }

  // ---------- Auth ----------
  async function signup() {
    const name = document.getElementById("signupName")?.value.trim();
    const email = document.getElementById("signupId")?.value.trim();
    const password = document.getElementById("signupPw")?.value;

    if (!name || !email || !password) {
      alert("모든 정보를 입력해주세요.");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name
        }
      }
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("회원가입이 완료되었습니다. 이메일 인증 설정이 켜져 있다면 메일을 확인해주세요.");
    closeSignup();
  }

  async function login() {
    const email = document.getElementById("signinId")?.value.trim();
    const password = document.getElementById("signinPw")?.value;

    if (!email || !password) {
      alert("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("로그인되었습니다.");
    closeSignin();
    await updateLoginUI();
  }

  async function logout() {
    await supabase.auth.signOut();
    alert("로그아웃되었습니다.");
    await updateLoginUI();
  }

  async function getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return null;
    }

    return data.user;
  }

  async function updateLoginUI() {
    const user = await getCurrentUser();

    const authButtons = document.getElementById("authButtons");
    const userMenu = document.getElementById("userMenu");
    const userGreeting = document.getElementById("userGreeting");
    const welcomeText = document.getElementById("welcomeText");

    if (user) {
      const name = user.user_metadata?.name || user.email;

      if (authButtons) authButtons.style.display = "none";
      if (userMenu) userMenu.style.display = "flex";
      if (userGreeting) userGreeting.textContent = `${name}님 환영합니다`;
      if (welcomeText) welcomeText.textContent = `${name}님, 환영합니다!`;
    } else {
      if (authButtons) authButtons.style.display = "flex";
      if (userMenu) userMenu.style.display = "none";
      if (welcomeText) welcomeText.textContent = "새로운 여행을 계획해보세요";
    }
  }

  // ---------- Utility ----------
  function parseQuery() {
    const params = {};
    const queryString = window.location.search.substring(1);
    const pairs = queryString.split("&");

    pairs.forEach((pair) => {
      if (!pair) return;

      const [key, value] = pair.split("=");
      params[decodeURIComponent(key)] = decodeURIComponent(value || "");
    });

    return params;
  }

  // ---------- Destinations ----------
  async function loadDestinations() {
    const { data, error } = await supabase
      .from("destinations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("여행지 데이터를 불러오지 못했습니다.");
      return;
    }

    DESTINATIONS = {};

    data.forEach((dest) => {
      DESTINATIONS[dest.name] = {
        id: dest.id,
        name: dest.name,
        description: dest.description,
        baseCost: dest.base_cost,
        image: dest.image
      };
    });
  }

  function createDestinationCard(destKey) {
    const dest = DESTINATIONS[destKey];

    const card = document.createElement("div");
    card.className = "destination-card";
    card.dataset.dest = destKey;

    const img = document.createElement("img");
    img.src = dest.image;
    img.alt = dest.name;
    card.appendChild(img);

    const content = document.createElement("div");
    content.className = "destination-card-content";

    const h3 = document.createElement("h3");
    h3.textContent = dest.name;

    const p = document.createElement("p");
    p.textContent = dest.description;

    const rating = document.createElement("div");
    rating.className = "avg-rating";
    rating.style.marginBottom = "10px";
    rating.textContent = "평점 없음";

    const btnContainer = document.createElement("div");
    btnContainer.className = "destination-buttons";

    const matchBtn = document.createElement("button");
    matchBtn.className = "cta-btn";
    matchBtn.style.background = "#10b981";
    matchBtn.textContent = "동행 찾기";
    matchBtn.onclick = () => {
      window.location.href = "matching.html?dest=" + encodeURIComponent(destKey);
    };

    const bookBtn = document.createElement("button");
    bookBtn.className = "cta-btn";
    bookBtn.textContent = "예약하기";
    bookBtn.onclick = () => {
      window.location.href = "booking.html?dest=" + encodeURIComponent(destKey);
    };

    btnContainer.appendChild(matchBtn);
    btnContainer.appendChild(bookBtn);

    content.appendChild(h3);
    content.appendChild(p);
    content.appendChild(rating);
    content.appendChild(btnContainer);

    card.appendChild(content);

    return card;
  }

  async function loadDestinationsPage() {
    const container = document.getElementById("destinationsContainer");
    if (!container) return;

    container.innerHTML = "";

    Object.keys(DESTINATIONS).forEach((key) => {
      const card = createDestinationCard(key);
      container.appendChild(card);
    });

    await updateAverageRatings();

    const searchInput = document.getElementById("destinationSearch");

    if (searchInput) {
      searchInput.oninput = () => {
        const query = searchInput.value.toLowerCase();
        const cards = container.querySelectorAll(".destination-card");

        cards.forEach((card) => {
          const title = card.querySelector("h3").textContent.toLowerCase();
          card.style.display = title.includes(query) ? "flex" : "none";
        });
      };
    }
  }

  // 여행지 등록용 함수입니다.
  // HTML에 name="destinationName" 같은 폼을 추가하면 사용할 수 있습니다.
  async function addDestination() {
    const user = await getCurrentUser();

    if (!user) {
      alert("여행지 등록은 로그인 후 가능합니다.");
      return;
    }

    const name = document.getElementById("destinationName")?.value.trim();
    const description = document.getElementById("destinationDescription")?.value.trim();
    const baseCost = Number(document.getElementById("destinationBaseCost")?.value || 0);
    const image = document.getElementById("destinationImage")?.value.trim();

    if (!name || !description || !baseCost || !image) {
      alert("여행지 이름, 설명, 비용, 이미지 파일명을 모두 입력해주세요.");
      return;
    }

    const { error } = await supabase
      .from("destinations")
      .insert({
        name,
        description,
        base_cost: baseCost,
        image
      });

    if (error) {
      alert(error.message);
      return;
    }

    alert("여행지가 등록되었습니다.");
    await loadDestinations();
    await loadDestinationsPage();
  }

  // ---------- Matching ----------
  async function applyMatching() {
    const user = await getCurrentUser();

    if (!user) {
      alert("매칭을 신청하려면 먼저 로그인해야 합니다.");
      return;
    }

    const destInput =
      document.getElementById("destinationSelect") ||
      document.getElementById("destination");

    const travelStyleEl = document.getElementById("travelStyle");
    const peopleEl = document.getElementById("peopleCount");

    if (!destInput || !travelStyleEl || !peopleEl) return;

    const destinationName = destInput.value.trim();
    const style = travelStyleEl.value;
    const peopleCount = parseInt(peopleEl.value, 10);

    const destination = DESTINATIONS[destinationName];

    if (!destination) {
      alert("여행지를 선택해주세요.");
      return;
    }

    const { data: existingGroups, error: groupError } = await supabase
      .from("match_groups")
      .select(`
        id,
        destination_id,
        travel_style,
        people_count,
        created_by,
        match_members (
          user_id
        )
      `)
      .eq("destination_id", destination.id)
      .eq("travel_style", style)
      .eq("people_count", peopleCount);

    if (groupError) {
      alert(groupError.message);
      return;
    }

    let targetGroup = null;

    for (const group of existingGroups || []) {
      const members = group.match_members || [];
      const alreadyJoined = members.some((m) => m.user_id === user.id);

      if (alreadyJoined) {
        targetGroup = group;
        break;
      }

      if (members.length < peopleCount) {
        targetGroup = group;
        break;
      }
    }

    if (!targetGroup) {
      const { data: newGroup, error: createError } = await supabase
        .from("match_groups")
        .insert({
          destination_id: destination.id,
          travel_style: style,
          people_count: peopleCount,
          created_by: user.id
        })
        .select()
        .single();

      if (createError) {
        alert(createError.message);
        return;
      }

      targetGroup = newGroup;
    }

    const { error: memberError } = await supabase
      .from("match_members")
      .insert({
        group_id: targetGroup.id,
        user_id: user.id
      });

    if (memberError && !memberError.message.includes("duplicate")) {
      alert(memberError.message);
      return;
    }

    await displayMatchResult(targetGroup.id);
  }

  async function displayMatchResult(groupId) {
    const resultEl = document.getElementById("matchResult");
    if (!resultEl) return;

    const { data: group, error } = await supabase
      .from("match_groups")
      .select(`
        id,
        travel_style,
        people_count,
        destinations (
          name
        ),
        match_members (
          user_id
        )
      `)
      .eq("id", groupId)
      .single();

    if (error || !group) {
      resultEl.textContent = "매칭 정보를 찾을 수 없습니다.";
      return;
    }

    const members = group.match_members || [];
    const memberNames = members.map((member, index) => {
      return `참가자 ${index + 1}`;
    });

    if (members.length < group.people_count) {
      resultEl.innerHTML = `
        <p>
          현재 ${members.length}/${group.people_count}명이 참여 중입니다.<br>
          매칭이 완료될 때까지 기다려 주세요.
        </p>
      `;
    } else {
      resultEl.innerHTML = `
        <p>
          매칭이 완료되었습니다!<br>
          참가자: ${memberNames.join(", ")}<br>
          <a href="chat.html">채팅방으로 이동</a>
        </p>
      `;
    }
  }

  async function initMatchingPage() {
    const destInput =
      document.getElementById("destinationSelect") ||
      document.getElementById("destination");

    if (destInput && destInput.tagName === "SELECT") {
      destInput.innerHTML = "";

      Object.keys(DESTINATIONS).forEach((key) => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = DESTINATIONS[key].name;
        destInput.appendChild(option);
      });
    }

    const params = parseQuery();

    if (destInput && params.dest) {
      destInput.value = params.dest;
    }
  }

  // ---------- Booking ----------
  function updateBookingCost() {
    const destSelect = document.getElementById("bookingDestination");
    const startInput = document.getElementById("startDate");
    const endInput = document.getElementById("endDate");
    const travelersInput = document.getElementById("numTravelers");
    const summaryEl = document.getElementById("costSummary");

    if (!destSelect || !startInput || !endInput || !travelersInput || !summaryEl) return;

    const dest = destSelect.value;
    const startDate = new Date(startInput.value);
    const endDate = new Date(endInput.value);
    const travelers = parseInt(travelersInput.value, 10) || 1;

    if (!dest || !startInput.value || !endInput.value) {
      summaryEl.textContent = "여행 날짜와 여행지를 선택하세요.";
      return;
    }

    const diffMs = endDate - startDate;

    if (isNaN(diffMs) || diffMs < 0) {
      summaryEl.textContent = "올바른 기간을 선택하세요.";
      return;
    }

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    const baseCost = DESTINATIONS[dest].baseCost;
    const total = days * travelers * baseCost;

    summaryEl.textContent = `${days}일, ${travelers}명 · 예상 비용: ${total.toLocaleString()}원`;
  }

  async function confirmBooking() {
    const user = await getCurrentUser();

    if (!user) {
      alert("예약하려면 먼저 로그인해야 합니다.");
      return;
    }

    const destSelect = document.getElementById("bookingDestination");
    const startInput = document.getElementById("startDate");
    const endInput = document.getElementById("endDate");
    const travelersInput = document.getElementById("numTravelers");
    const summaryEl = document.getElementById("costSummary");

    if (!destSelect || !startInput || !endInput || !travelersInput) return;

    const destName = destSelect.value;
    const destination = DESTINATIONS[destName];
    const startDate = new Date(startInput.value);
    const endDate = new Date(endInput.value);
    const travelers = parseInt(travelersInput.value, 10) || 1;

    if (!destination || !startInput.value || !endInput.value) {
      alert("여행 날짜와 여행지를 선택하세요.");
      return;
    }

    const diffMs = endDate - startDate;

    if (isNaN(diffMs) || diffMs < 0) {
      alert("올바른 기간을 선택하세요.");
      return;
    }

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    const total = days * travelers * destination.baseCost;

    const { error } = await supabase
      .from("bookings")
      .insert({
        user_id: user.id,
        destination_id: destination.id,
        start_date: startInput.value,
        end_date: endInput.value,
        travelers,
        cost: total
      });

    if (error) {
      alert(error.message);
      return;
    }

    alert("예약이 완료되었습니다!");

    startInput.value = "";
    endInput.value = "";
    travelersInput.value = "1";
    if (summaryEl) summaryEl.textContent = "";

    await loadBookings();
  }

  async function loadBookings() {
    const bookingsEl = document.getElementById("bookingHistory");
    if (!bookingsEl) return;

    const user = await getCurrentUser();

    bookingsEl.innerHTML = "";

    if (!user) {
      bookingsEl.textContent = "예약 내역을 보려면 로그인하세요.";
      return;
    }

    const { data, error } = await supabase
      .from("bookings")
      .select(`
        id,
        start_date,
        end_date,
        travelers,
        cost,
        destinations (
          name
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      bookingsEl.textContent = "예약 내역을 불러오지 못했습니다.";
      console.error(error);
      return;
    }

    if (!data || data.length === 0) {
      bookingsEl.textContent = "예약 내역이 없습니다.";
      return;
    }

    const ul = document.createElement("ul");
    ul.style.listStyle = "none";
    ul.style.padding = "0";

    data.forEach((item) => {
      const li = document.createElement("li");
      li.style.marginBottom = "8px";

      li.textContent = `${item.destinations?.name || "여행지"}: ${item.start_date} ~ ${item.end_date}, ${item.travelers}명, ${item.cost.toLocaleString()}원`;

      ul.appendChild(li);
    });

    bookingsEl.appendChild(ul);
  }

  async function initBookingPage() {
    const destSelect = document.getElementById("bookingDestination");

    if (destSelect) {
      destSelect.innerHTML = "";

      Object.keys(DESTINATIONS).forEach((key) => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = DESTINATIONS[key].name;
        destSelect.appendChild(option);
      });
    }

    const startInput = document.getElementById("startDate");
    const endInput = document.getElementById("endDate");
    const travelersInput = document.getElementById("numTravelers");

    if (destSelect) destSelect.onchange = updateBookingCost;
    if (startInput) startInput.onchange = updateBookingCost;
    if (endInput) endInput.onchange = updateBookingCost;
    if (travelersInput) travelersInput.oninput = updateBookingCost;

    const params = parseQuery();

    if (destSelect && params.dest) {
      destSelect.value = params.dest;
    }

    await loadBookings();
  }

  // ---------- Reviews ----------
  async function submitReview() {
    const user = await getCurrentUser();

    if (!user) {
      alert("후기를 작성하려면 먼저 로그인해야 합니다.");
      return;
    }

    const destSelect = document.getElementById("reviewDestination");
    const ratingSelect = document.getElementById("reviewRating");
    const commentInput = document.getElementById("reviewComment");

    if (!destSelect || !ratingSelect || !commentInput) return;

    const destName = destSelect.value;
    const destination = DESTINATIONS[destName];
    const rating = parseInt(ratingSelect.value, 10);
    const comment = commentInput.value.trim();

    if (!destination || !rating || !comment) {
      alert("모든 항목을 입력해주세요.");
      return;
    }

    const { error } = await supabase
      .from("reviews")
      .insert({
        user_id: user.id,
        destination_id: destination.id,
        rating,
        comment
      });

    if (error) {
      alert(error.message);
      return;
    }

    alert("리뷰가 제출되었습니다.");
    commentInput.value = "";

    await loadReviews();
    await updateAverageRatings();
  }

  async function loadReviews() {
    const listEl = document.getElementById("reviewList");
    const filterSelect = document.getElementById("reviewFilter");

    if (!listEl || !filterSelect) return;

    const destinationFilter = filterSelect.value;

    let query = supabase
      .from("reviews")
      .select(`
        id,
        rating,
        comment,
        created_at,
        user_id,
        destinations (
          name
        )
      `)
      .order("created_at", { ascending: false });

    if (destinationFilter !== "all") {
      const destination = DESTINATIONS[destinationFilter];

      if (destination) {
        query = query.eq("destination_id", destination.id);
      }
    }

    const { data, error } = await query;

    listEl.innerHTML = "";

    if (error) {
      listEl.textContent = "후기를 불러오지 못했습니다.";
      console.error(error);
      return;
    }

    if (!data || data.length === 0) {
      listEl.textContent = "아직 후기가 없습니다.";
      return;
    }

    data.forEach((review) => {
      const div = document.createElement("div");
      div.className = "review-item";

      const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
      const date = new Date(review.created_at).toLocaleDateString("ko-KR");

      div.innerHTML = `
        <div class="stars">${stars}</div>
        <div><strong>${review.destinations?.name || "여행지"}</strong></div>
        <div>${review.comment}</div>
        <div style="font-size:12px;color:#6b7280;">${date}</div>
      `;

      listEl.appendChild(div);
    });
  }

  async function updateAverageRatings() {
    const cards = document.querySelectorAll(".destination-card");
    if (!cards) return;

    const { data, error } = await supabase
      .from("reviews")
      .select(`
        rating,
        destination_id
      `);

    if (error) {
      console.error(error);
      return;
    }

    cards.forEach((card) => {
      const destName = card.dataset.dest;
      const ratingEl = card.querySelector(".avg-rating");
      const destination = DESTINATIONS[destName];

      if (!ratingEl || !destination) return;

      const destReviews = data.filter((r) => r.destination_id === destination.id);

      if (destReviews.length === 0) {
        ratingEl.textContent = "별점 없음";
      } else {
        const avg =
          destReviews.reduce((sum, r) => sum + r.rating, 0) / destReviews.length;

        ratingEl.textContent = `평점: ${avg.toFixed(1)} / 5 (${destReviews.length}건)`;
      }
    });
  }

  async function initReviewPage() {
    const destSelect = document.getElementById("reviewDestination");
    const filterSelect = document.getElementById("reviewFilter");

    if (destSelect) {
      destSelect.innerHTML = "";

      Object.keys(DESTINATIONS).forEach((key) => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = DESTINATIONS[key].name;
        destSelect.appendChild(option);
      });
    }

    if (filterSelect) {
      filterSelect.innerHTML = "";

      const allOpt = document.createElement("option");
      allOpt.value = "all";
      allOpt.textContent = "전체";
      filterSelect.appendChild(allOpt);

      Object.keys(DESTINATIONS).forEach((key) => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = DESTINATIONS[key].name;
        filterSelect.appendChild(option);
      });

      filterSelect.onchange = loadReviews;
    }

    await loadReviews();
  }

  // ---------- Chat ----------
  async function loadChatPage() {
    const user = await getCurrentUser();

    const groupListEl = document.getElementById("groupList");
    const infoEl = document.getElementById("chatGroupInfo");
    const chatBox = document.getElementById("chatBox");

    if (!groupListEl || !infoEl || !chatBox) return;

    groupListEl.innerHTML = "";
    chatBox.innerHTML = "";

    if (!user) {
      infoEl.textContent = "로그인 후 채팅을 이용할 수 있습니다.";
      return;
    }

    const { data, error } = await supabase
      .from("match_members")
      .select(`
        group_id,
        match_groups (
          id,
          travel_style,
          people_count,
          destinations (
            name
          )
        )
      `)
      .eq("user_id", user.id);

    if (error) {
      infoEl.textContent = "채팅방 정보를 불러오지 못했습니다.";
      console.error(error);
      return;
    }

    CURRENT_GROUPS = data || [];

    if (CURRENT_GROUPS.length === 0) {
      infoEl.textContent = "참여 중인 매칭 채팅방이 없습니다.";
      return;
    }

    CURRENT_GROUPS.forEach((item) => {
      const group = item.match_groups;

      const btn = document.createElement("button");
      btn.textContent = `${group.destinations?.name || "여행지"} / ${group.travel_style}`;
      btn.onclick = () => openChat(group.id);

      groupListEl.appendChild(btn);
    });

    infoEl.textContent = "대화방을 선택하세요.";
  }

  function openChat(groupId) {
    currentGroupId = groupId;

    const groupListEl = document.getElementById("groupList");
    const buttons = groupListEl ? groupListEl.getElementsByTagName("button") : [];

    for (const btn of buttons) {
      btn.classList.remove("active");
    }

    const activeGroup = CURRENT_GROUPS.find(
      (item) => item.match_groups.id === groupId
    );

    const activeBtn = Array.from(buttons).find((btn) => {
      const group = activeGroup?.match_groups;
      if (!group) return false;

      return btn.textContent === `${group.destinations?.name || "여행지"} / ${group.travel_style}`;
    });

    if (activeBtn) activeBtn.classList.add("active");

    renderChatHeader(groupId);
    renderMessages(groupId);
  }

  function renderChatHeader(groupId) {
    const infoEl = document.getElementById("chatGroupInfo");
    if (!infoEl) return;

    const activeGroup = CURRENT_GROUPS.find(
      (item) => item.match_groups.id === groupId
    );

    if (!activeGroup) {
      infoEl.textContent = "채팅 정보를 찾을 수 없습니다.";
      return;
    }

    const group = activeGroup.match_groups;

    infoEl.textContent = `${group.destinations?.name || "여행지"} / ${group.travel_style} 채팅방`;
  }

  async function renderMessages(groupId) {
    const chatBox = document.getElementById("chatBox");
    if (!chatBox) return;

    chatBox.innerHTML = "";

    const { data, error } = await supabase
      .from("messages")
      .select(`
        id,
        user_id,
        text,
        created_at
      `)
      .eq("group_id", groupId)
      .order("created_at", { ascending: true });

    if (error) {
      chatBox.textContent = "메시지를 불러오지 못했습니다.";
      console.error(error);
      return;
    }

    data.forEach((msg) => {
      const div = document.createElement("div");
      div.className = "chat-message";

      const time = new Date(msg.created_at).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit"
      });

      div.innerHTML = `
        <strong>${msg.user_id.slice(0, 8)}</strong>
        <span style="font-size:12px;color:#6b7280;">${time}</span><br>
        ${msg.text}
      `;

      chatBox.appendChild(div);
    });

    chatBox.scrollTop = chatBox.scrollHeight;
  }

  async function sendMessage() {
    const user = await getCurrentUser();

    if (!user) {
      alert("메시지를 보내려면 먼저 로그인하세요.");
      return;
    }

    if (!currentGroupId) {
      alert("대화방을 먼저 선택하세요.");
      return;
    }

    const input = document.getElementById("chatMessage");
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    const { error } = await supabase
      .from("messages")
      .insert({
        group_id: currentGroupId,
        user_id: user.id,
        text
      });

    if (error) {
      alert(error.message);
      return;
    }

    input.value = "";
    await renderMessages(currentGroupId);
  }

  // ---------- Page Init ----------
  window.onload = async function () {
    await updateLoginUI();
    await loadDestinations();

    const page = document.body.dataset.page;

    switch (page) {
      case "matching":
        await initMatchingPage();
        break;

      case "booking":
        await initBookingPage();
        break;

      case "reviews":
        await initReviewPage();
        break;

      case "destinations":
        await loadDestinationsPage();
        break;

      case "chat":
        await loadChatPage();
        break;

      case "about":
        break;

      default:
        break;
    }
  };

  // ---------- Expose global functions ----------
  window.openSignin = openSignin;
  window.closeSignin = closeSignin;
  window.openSignup = openSignup;
  window.closeSignup = closeSignup;
  window.signup = signup;
  window.login = login;
  window.logout = logout;
  window.applyMatching = applyMatching;
  window.updateBookingCost = updateBookingCost;
  window.confirmBooking = confirmBooking;
  window.submitReview = submitReview;
  window.sendMessage = sendMessage;
  window.addDestination = addDestination;
})();
