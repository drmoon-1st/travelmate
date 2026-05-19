/*
  TravelMate client-side logic using a simple REST API.

  This script replaces localStorage-based data handling with
  asynchronous fetch calls to the backend defined in server.js.
  All user data, destinations, matches, bookings, reviews and
  chat messages are persisted in db.json via API endpoints.
*/

(function() {
  // Globals to store fetched data
  let DESTINATIONS = {};
  let GROUPS = [];
  let currentGroupId = null;

  // Generic helper for API requests. Automatically parses JSON.
  async function apiRequest(path, method = 'GET', body = null) {
    const options = { method, headers: {} };
    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    try {
      const res = await fetch(path, options);
      return await res.json();
    } catch (err) {
      console.error('API request failed', err);
      return { success: false, message: '네트워크 오류가 발생했습니다.' };
    }
  }

  // ----- Modals for sign-in and sign-up -----
  function openSignin() {
    const modal = document.getElementById('signinModal');
    if (modal) modal.style.display = 'block';
  }
  function closeSignin() {
    const modal = document.getElementById('signinModal');
    if (modal) modal.style.display = 'none';
  }
  function openSignup() {
    const modal = document.getElementById('signupModal');
    if (modal) modal.style.display = 'block';
  }
  function closeSignup() {
    const modal = document.getElementById('signupModal');
    if (modal) modal.style.display = 'none';
  }

  // ----- Authentication -----
  async function signup() {
    const name = document.getElementById('signupName')?.value.trim() || '';
    const id = document.getElementById('signupId')?.value.trim() || '';
    const pw = document.getElementById('signupPw')?.value || '';
    const age = document.getElementById('signupAge')?.value || '';
    if (!name || !id || !pw) {
      alert('모든 정보를 입력해주세요.');
      return;
    }
    const res = await apiRequest('/api/signup', 'POST', { name, id, pw, age });
    if (res.success) {
      alert('회원가입이 완료되었습니다.');
      closeSignup();
    } else {
      alert(res.message || '회원가입에 실패했습니다.');
    }
  }

  async function login() {
    const id = document.getElementById('signinId')?.value.trim() || '';
    const pw = document.getElementById('signinPw')?.value || '';
    if (!id || !pw) {
      alert('아이디와 비밀번호를 입력해주세요.');
      return;
    }
    const res = await apiRequest('/api/login', 'POST', { id, pw });
    if (res.success && res.user) {
      localStorage.setItem('loginUser', JSON.stringify(res.user));
      closeSignin();
      updateLoginUI();
    } else {
      alert(res.message || '로그인에 실패했습니다.');
    }
  }

  function logout() {
    localStorage.removeItem('loginUser');
    updateLoginUI();
  }

  function updateLoginUI() {
    const loginUser = getCurrentUser();
    const authButtons = document.getElementById('authButtons');
    const userMenu = document.getElementById('userMenu');
    const userGreeting = document.getElementById('userGreeting');
    const welcomeText = document.getElementById('welcomeText');
    if (loginUser) {
      if (authButtons) authButtons.style.display = 'none';
      if (userMenu) userMenu.style.display = 'flex';
      if (userGreeting) userGreeting.textContent = loginUser.id + '님 환영합니다';
      if (welcomeText) welcomeText.textContent = loginUser.id + '님, 환영합니다!';
    } else {
      if (authButtons) authButtons.style.display = 'flex';
      if (userMenu) userMenu.style.display = 'none';
      if (welcomeText) welcomeText.textContent = '새로운 여행을 계획해보세요';
    }
  }

  function getCurrentUser() {
    return JSON.parse(localStorage.getItem('loginUser') || 'null');
  }

  // Parse the query string into an object
  function parseQuery() {
    const params = {};
    const queryString = window.location.search.substring(1);
    const pairs = queryString.split('&');
    pairs.forEach(pair => {
      if (!pair) return;
      const [key, value] = pair.split('=');
      params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    });
    return params;
  }

  // ----- Destinations -----
  async function fetchDestinations() {
    const res = await apiRequest('/api/destinations');
    if (res.success && Array.isArray(res.destinations)) {
      DESTINATIONS = {};
      res.destinations.forEach(dest => {
        DESTINATIONS[dest.name] = dest;
      });
    } else {
      console.error('Failed to load destinations', res.message);
    }
  }

  function createDestinationCard(destKey) {
    const dest = DESTINATIONS[destKey];
    const card = document.createElement('div');
    card.className = 'destination-card';
    card.dataset.dest = destKey;
    const img = document.createElement('img');
    img.src = dest.image;
    img.alt = dest.name;
    card.appendChild(img);
    const content = document.createElement('div');
    content.className = 'destination-card-content';
    const h3 = document.createElement('h3');
    h3.textContent = dest.name;
    const p = document.createElement('p');
    p.textContent = dest.description;
    const rating = document.createElement('div');
    rating.className = 'avg-rating';
    rating.style.marginBottom = '10px';
    rating.textContent = '별점 없음';
    const btnContainer = document.createElement('div');
    btnContainer.className = 'destination-buttons';
    const matchBtn = document.createElement('button');
    matchBtn.className = 'cta-btn';
    matchBtn.style.background = '#10b981';
    matchBtn.textContent = '동행 찾기';
    matchBtn.onclick = () => {
      window.location.href = 'matching.html?dest=' + encodeURIComponent(destKey);
    };
    const bookBtn = document.createElement('button');
    bookBtn.className = 'cta-btn';
    bookBtn.textContent = '예약하기';
    bookBtn.onclick = () => {
      window.location.href = 'booking.html?dest=' + encodeURIComponent(destKey);
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
    const container = document.getElementById('destinationsContainer');
    if (!container) return;
    container.innerHTML = '';
    Object.keys(DESTINATIONS).forEach(key => {
      const card = createDestinationCard(key);
      container.appendChild(card);
    });
    await updateAverageRatings();
    const searchInput = document.getElementById('destinationSearch');
    if (searchInput) {
      searchInput.oninput = () => {
        const query = searchInput.value.toLowerCase();
        const cards = container.querySelectorAll('.destination-card');
        cards.forEach(card => {
          const title = card.querySelector('h3').textContent.toLowerCase();
          card.style.display = title.includes(query) ? 'flex' : 'none';
        });
      };
    }
  }

  // ----- Matching -----
  async function applyMatching() {
    const user = getCurrentUser();
    if (!user) {
      alert('매칭을 신청하려면 먼저 로그인해야 합니다.');
      return;
    }
    const destInput = document.getElementById('destinationSelect') || document.getElementById('destination');
    const travelStyleEl = document.getElementById('travelStyle');
    const peopleEl = document.getElementById('peopleCount');
    if (!destInput || !travelStyleEl || !peopleEl) return;
    const destination = destInput.value.trim();
    const style = travelStyleEl.value;
    const peopleCount = parseInt(peopleEl.value, 10);
    if (!destination) {
      alert('여행지를 입력하세요.');
      return;
    }
    // Check existing match
    const status = await apiRequest('/api/match/status?userId=' + encodeURIComponent(user.id));
    if (status.success && status.group) {
      displayMatchResult(status.group);
      return;
    }
    // Create or join group
    const res = await apiRequest('/api/match', 'POST', { userId: user.id, destination, style, peopleCount });
    if (res.success && res.group) {
      displayMatchResult(res.group);
    } else {
      alert(res.message || '매칭에 실패했습니다.');
    }
  }

  function displayMatchResult(group) {
    const resultEl = document.getElementById('matchResult');
    if (!resultEl) return;
    if (!group) {
      resultEl.textContent = '매칭 정보를 찾을 수 없습니다.';
      return;
    }
    const memberNames = group.memberNames || group.members || [];
    if (group.members.length < group.peopleCount) {
      resultEl.innerHTML = `<p>현재 ${memberNames.join(', ')}님이 참여 중입니다.<br>매칭이 완료될 때까지 기다려 주세요.</p>`;
    } else {
      resultEl.innerHTML = `<p>매칭이 완료되었습니다! 참가자: ${memberNames.join(', ')}<br><a href="chat.html">채팅방으로 이동</a></p>`;
    }
  }

  async function initMatchingPage() {
    // Populate destination select
    const destInput = document.getElementById('destinationSelect') || document.getElementById('destination');
    if (destInput) {
      destInput.innerHTML = '';
      Object.keys(DESTINATIONS).forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = DESTINATIONS[key].name;
        destInput.appendChild(option);
      });
    }
    // Preselect from query
    const params = parseQuery();
    if (destInput && params.dest) {
      destInput.value = params.dest;
    }
    // Show current request if exists
    const user = getCurrentUser();
    if (user) {
      const status = await apiRequest('/api/match/status?userId=' + encodeURIComponent(user.id));
      if (status.success && status.group) {
        displayMatchResult(status.group);
      }
    }
  }

  // ----- Booking -----
  function updateBookingCost() {
    const destSelect = document.getElementById('bookingDestination');
    const startInput = document.getElementById('startDate');
    const endInput = document.getElementById('endDate');
    const travelersInput = document.getElementById('numTravelers');
    const summaryEl = document.getElementById('costSummary');
    if (!destSelect || !startInput || !endInput || !travelersInput || !summaryEl) return;
    const dest = destSelect.value;
    const startDate = new Date(startInput.value);
    const endDate = new Date(endInput.value);
    const travelers = parseInt(travelersInput.value, 10) || 1;
    if (!dest || !startInput.value || !endInput.value) {
      summaryEl.textContent = '여행 날짜와 여행지를 선택하세요.';
      return;
    }
    const diffMs = endDate - startDate;
    if (isNaN(diffMs) || diffMs < 0) {
      summaryEl.textContent = '올바른 기간을 선택하세요.';
      return;
    }
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    const baseCost = DESTINATIONS[dest].baseCost;
    const total = days * travelers * baseCost;
    summaryEl.textContent = `${days}박 ${days}일, ${travelers}명 · 예상 비용: ${total.toLocaleString()}원`;
  }

  async function confirmBooking() {
    const user = getCurrentUser();
    if (!user) {
      alert('예약하려면 먼저 로그인해야 합니다.');
      return;
    }
    const destSelect = document.getElementById('bookingDestination');
    const startInput = document.getElementById('startDate');
    const endInput = document.getElementById('endDate');
    const travelersInput = document.getElementById('numTravelers');
    const summaryEl = document.getElementById('costSummary');
    if (!destSelect || !startInput || !endInput || !travelersInput) return;
    const dest = destSelect.value;
    const startDate = new Date(startInput.value);
    const endDate = new Date(endInput.value);
    const travelers = parseInt(travelersInput.value, 10) || 1;
    if (!dest || !startInput.value || !endInput.value) {
      alert('여행 날짜와 여행지를 선택하세요.');
      return;
    }
    const diffMs = endDate - startDate;
    if (isNaN(diffMs) || diffMs < 0) {
      alert('올바른 기간을 선택하세요.');
      return;
    }
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    const baseCost = DESTINATIONS[dest].baseCost;
    const total = days * travelers * baseCost;
    const res = await apiRequest('/api/bookings', 'POST', {
      userId: user.id,
      destination: dest,
      startDate: startInput.value,
      endDate: endInput.value,
      travelers,
      cost: total
    });
    if (res.success) {
      alert('예약이 완료되었습니다!');
      startInput.value = '';
      endInput.value = '';
      travelersInput.value = '1';
      summaryEl.textContent = '';
      await loadBookings();
    } else {
      alert(res.message || '예약에 실패했습니다.');
    }
  }

  async function loadBookings() {
    const bookingsEl = document.getElementById('bookingHistory');
    if (!bookingsEl) return;
    const user = getCurrentUser();
    bookingsEl.innerHTML = '';
    if (!user) {
      bookingsEl.textContent = '예약 내역을 보려면 로그인하세요.';
      return;
    }
    const res = await apiRequest('/api/bookings?userId=' + encodeURIComponent(user.id));
    if (res.success) {
      const list = res.bookings || [];
      if (list.length === 0) {
        bookingsEl.textContent = '예약 내역이 없습니다.';
        return;
      }
      const ul = document.createElement('ul');
      ul.style.listStyle = 'none';
      ul.style.padding = '0';
      list.forEach(item => {
        const li = document.createElement('li');
        li.style.marginBottom = '8px';
        li.textContent = `${item.destination}: ${item.startDate} ~ ${item.endDate}, ${item.travelers}명, ${item.cost.toLocaleString()}원`;
        ul.appendChild(li);
      });
      bookingsEl.appendChild(ul);
    } else {
      bookingsEl.textContent = res.message || '예약 정보를 불러올 수 없습니다.';
    }
  }

  async function initBookingPage() {
    // Populate destination select
    const destSelect = document.getElementById('bookingDestination');
    if (destSelect) {
      destSelect.innerHTML = '';
      Object.keys(DESTINATIONS).forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = DESTINATIONS[key].name;
        destSelect.appendChild(option);
      });
    }
    // Attach listeners
    if (destSelect) destSelect.onchange = updateBookingCost;
    const startInput = document.getElementById('startDate');
    const endInput = document.getElementById('endDate');
    const travelersInput = document.getElementById('numTravelers');
    if (startInput) startInput.onchange = updateBookingCost;
    if (endInput) endInput.onchange = updateBookingCost;
    if (travelersInput) travelersInput.oninput = updateBookingCost;
    await loadBookings();
    // Preselect from query
    const params = parseQuery();
    if (destSelect && params.dest) {
      destSelect.value = params.dest;
    }
  }

  // ----- Reviews -----
  async function submitReview() {
    const user = getCurrentUser();
    if (!user) {
      alert('후기를 작성하려면 먼저 로그인해야 합니다.');
      return;
    }
    const destSelect = document.getElementById('reviewDestination');
    const ratingSelect = document.getElementById('reviewRating');
    const commentInput = document.getElementById('reviewComment');
    if (!destSelect || !ratingSelect || !commentInput) return;
    const destination = destSelect.value;
    const rating = parseInt(ratingSelect.value, 10);
    const comment = commentInput.value.trim();
    if (!destination || !rating || !comment) {
      alert('모든 항목을 입력해주세요.');
      return;
    }
    const res = await apiRequest('/api/reviews', 'POST', {
      userId: user.id,
      destination,
      rating,
      comment
    });
    if (res.success) {
      alert('리뷰가 제출되었습니다.');
      commentInput.value = '';
      await loadReviews();
      await updateAverageRatings();
    } else {
      alert(res.message || '리뷰를 제출할 수 없습니다.');
    }
  }

  async function loadReviews() {
    const listEl = document.getElementById('reviewList');
    const filterSelect = document.getElementById('reviewFilter');
    if (!listEl || !filterSelect) return;
    const destinationFilter = filterSelect.value;
    const query = destinationFilter && destinationFilter !== 'all' ? '?destination=' + encodeURIComponent(destinationFilter) : '';
    const res = await apiRequest('/api/reviews' + query);
    listEl.innerHTML = '';
    if (!res.success) {
      listEl.textContent = res.message || '리뷰를 불러올 수 없습니다.';
      return;
    }
    const reviews = res.reviews || [];
    if (reviews.length === 0) {
      listEl.textContent = '아직 후기가 없습니다.';
      return;
    }
    reviews.sort((a,b) => b.timestamp - a.timestamp);
    reviews.forEach(review => {
      const div = document.createElement('div');
      div.className = 'review-item';
      const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
      const date = new Date(review.timestamp).toLocaleDateString('ko-KR');
      div.innerHTML = `<div class="stars">${stars}</div><div>${review.comment}</div><div style="font-size:12px;color:#6b7280;">${review.userId} · ${date}</div>`;
      listEl.appendChild(div);
    });
  }

  async function updateAverageRatings() {
    // Fetch all reviews to compute averages
    const res = await apiRequest('/api/reviews');
    if (!res.success) return;
    const allReviews = res.reviews || [];
    const cards = document.querySelectorAll('.destination-card');
    cards.forEach(card => {
      const destKey = card.dataset.dest;
      const ratingEl = card.querySelector('.avg-rating');
      if (!ratingEl) return;
      const destReviews = allReviews.filter(r => r.destination === destKey);
      if (destReviews.length === 0) {
        ratingEl.textContent = '별점 없음';
      } else {
        const avg = destReviews.reduce((sum, r) => sum + r.rating, 0) / destReviews.length;
        ratingEl.textContent = '평점: ' + avg.toFixed(1) + ' / 5 (' + destReviews.length + '건)';
      }
    });
  }

  async function initReviewPage() {
    // Populate select options
    const destSelect = document.getElementById('reviewDestination');
    const filterSelect = document.getElementById('reviewFilter');
    if (destSelect) {
      destSelect.innerHTML = '';
      Object.keys(DESTINATIONS).forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = DESTINATIONS[key].name;
        destSelect.appendChild(option);
      });
    }
    if (filterSelect) {
      filterSelect.innerHTML = '';
      const allOpt = document.createElement('option');
      allOpt.value = 'all';
      allOpt.textContent = '전체';
      filterSelect.appendChild(allOpt);
      Object.keys(DESTINATIONS).forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = DESTINATIONS[key].name;
        filterSelect.appendChild(option);
      });
      filterSelect.onchange = loadReviews;
    }
    await loadReviews();
  }

  // ----- Chat -----
  async function loadChatPage() {
    const user = getCurrentUser();
    const groupListEl = document.getElementById('groupList');
    const infoEl = document.getElementById('chatGroupInfo');
    const chatBox = document.getElementById('chatBox');
    if (!groupListEl || !infoEl || !chatBox) return;
    groupListEl.innerHTML = '';
    chatBox.innerHTML = '';
    // Public chat button
    const publicButton = document.createElement('button');
    publicButton.textContent = 'Public';
    publicButton.onclick = () => openChat('public');
    groupListEl.appendChild(publicButton);
    // List user's groups
    if (user) {
      const res = await apiRequest('/api/match/groups?userId=' + encodeURIComponent(user.id));
      if (res.success) {
        GROUPS = res.groups || [];
        GROUPS.forEach(group => {
          const btn = document.createElement('button');
          btn.textContent = `${group.destination} / ${group.style}`;
          btn.onclick = () => openChat(group.groupId);
          groupListEl.appendChild(btn);
        });
      }
    } else {
      const notice = document.createElement('div');
      notice.textContent = '로그인하여 개인 채팅방을 이용하세요.';
      notice.style.fontSize = '14px';
      notice.style.color = '#6b7280';
      groupListEl.appendChild(notice);
    }
    infoEl.textContent = '대화방을 선택하세요.';
  }

  function openChat(groupId) {
    currentGroupId = groupId;
    const groupListEl = document.getElementById('groupList');
    const buttons = groupListEl ? groupListEl.getElementsByTagName('button') : [];
    for (const btn of buttons) {
      btn.classList.remove('active');
    }
    // Highlight active button
    const activeBtn = Array.from(buttons).find(btn => {
      if (groupId === 'public') {
        return btn.textContent === 'Public';
      }
      const group = GROUPS.find(g => g.groupId === groupId);
      return group && btn.textContent === `${group.destination} / ${group.style}`;
    });
    if (activeBtn) activeBtn.classList.add('active');
    renderChatHeader(groupId);
    renderMessages(groupId);
  }

  function renderChatHeader(groupId) {
    const infoEl = document.getElementById('chatGroupInfo');
    if (!infoEl) return;
    if (groupId === 'public') {
      infoEl.textContent = '전체 공개 채팅방';
      return;
    }
    const group = GROUPS.find(g => g.groupId === groupId);
    if (!group) {
      infoEl.textContent = '채팅 정보를 찾을 수 없습니다.';
      return;
    }
    const memberNames = group.memberNames || group.members || [];
    infoEl.textContent = `${group.destination} / ${group.style} · 참가자: ${memberNames.join(', ')}`;
  }

  async function renderMessages(groupId) {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) return;
    chatBox.innerHTML = '';
    if (!groupId) return;
    const res = await apiRequest('/api/messages?groupId=' + encodeURIComponent(groupId));
    if (!res.success) {
      chatBox.textContent = res.message || '메시지를 불러올 수 없습니다.';
      return;
    }
    const msgs = res.messages || [];
    msgs.forEach(msg => {
      const div = document.createElement('div');
      div.className = 'chat-message';
      const time = new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      div.innerHTML = `<strong>${msg.userId}</strong> <span style="font-size:12px;color:#6b7280;">${time}</span><br>${msg.text}`;
      chatBox.appendChild(div);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  async function sendMessage() {
    const user = getCurrentUser();
    if (!user) {
      alert('메시지를 보내려면 먼저 로그인하세요.');
      return;
    }
    if (!currentGroupId) {
      alert('대화방을 먼저 선택하세요.');
      return;
    }
    const input = document.getElementById('chatMessage');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    const res = await apiRequest('/api/messages', 'POST', { userId: user.id, groupId: currentGroupId, text });
    if (res.success) {
      input.value = '';
      await renderMessages(currentGroupId);
    } else {
      alert(res.message || '메시지를 보낼 수 없습니다.');
    }
  }

  // ----- Page initialisation -----
  window.onload = async function() {
    updateLoginUI();
    await fetchDestinations();
    const page = document.body.dataset.page;
    switch (page) {
      case 'matching':
        await initMatchingPage();
        break;
      case 'booking':
        await initBookingPage();
        break;
      case 'reviews':
        await initReviewPage();
        break;
      case 'destinations':
        await loadDestinationsPage();
        break;
      case 'chat':
        await loadChatPage();
        break;
      case 'about':
        // nothing special
        break;
      default:
        // home page: nothing additional
        break;
    }
  };

  // Expose functions globally for inline handlers
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
})();