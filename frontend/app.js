const API_URL = 'https://super-fortnight-be.onrender.com/api';
let currentUser = null;
let feedbackSDK = null;
let messengerWidget = null;
let isLoginMode = true;

const PRODUCT7_SUBDOMAIN = 'zed';

function getProduct7BaseUrls() {
  const isDev = true;
  const baseDomain = isDev ? 'product7.io' : 'product7.io';
  const base = `https://${PRODUCT7_SUBDOMAIN}.${baseDomain}`;

  return {
    feedbackUrl: `${base}/feedback`,
    changelogUrl: `${base}/changelog`,
    helpUrl: `${base}/help-docs`,
    roadmapUrl: `${base}/roadmap`,
  };
}

function showAuthModal() {
  document.getElementById('authModal').classList.add('active');
}

function hideAuthModal() {
  document.getElementById('authModal').classList.remove('active');
}

function toggleAuthMode() {
  isLoginMode = !isLoginMode;
  const nameGroup = document.getElementById('nameGroup');
  const modalTitle = document.getElementById('modalTitle');
  const submitBtn = document.getElementById('submitBtn');
  const switchText = document.getElementById('switchText');
  const switchLink = document.getElementById('switchLink');

  if (isLoginMode) {
    nameGroup.style.display = 'none';
    modalTitle.textContent = 'Sign In';
    submitBtn.textContent = 'Sign In';
    switchText.textContent = "Don't have an account?";
    switchLink.textContent = 'Sign Up';
  } else {
    nameGroup.style.display = 'block';
    modalTitle.textContent = 'Sign Up';
    submitBtn.textContent = 'Sign Up';
    switchText.textContent = 'Already have an account?';
    switchLink.textContent = 'Sign In';
  }
  document.getElementById('errorMsg').textContent = '';
}

document.getElementById('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const name = document.getElementById('name').value;
  const errorMsg = document.getElementById('errorMsg');

  try {
    const endpoint = isLoginMode ? '/login' : '/register';
    const body = isLoginMode 
      ? { email, password }
      : { email, password, name };

    const response = await fetch(API_URL + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      errorMsg.textContent = data.error || 'Authentication failed';
      return;
    }

    localStorage.setItem('authToken', data.token);
    currentUser = data.userContext;
    
    updateUI();
    hideAuthModal();
    await initializeSDK();
    
  } catch (error) {
    errorMsg.textContent = 'Connection failed. Make sure backend is running on localhost:3000';
  }
});

function updateUI() {
  if (currentUser) {
    document.getElementById('userInfo').textContent = `Welcome, ${currentUser.name}`;
    document.getElementById('userInfo').style.display = 'block';
    document.getElementById('authBtn').textContent = 'Logout';
    document.getElementById('authBtn').onclick = logout;
  }
}

function logout() {
  localStorage.removeItem('authToken');
  currentUser = null;
  document.getElementById('userInfo').style.display = 'none';
  document.getElementById('authBtn').textContent = 'Sign In';
  document.getElementById('authBtn').onclick = showAuthModal;
  
  if (messengerWidget) {
    messengerWidget.destroy();
    messengerWidget = null;
  }
  
  if (feedbackSDK) {
    feedbackSDK.destroy();
    feedbackSDK = null;
  }
}

async function checkAuth() {
  const token = localStorage.getItem('authToken');
  if (!token) return;

  try {
    const response = await fetch(API_URL + '/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      currentUser = data.userContext;
      updateUI();
      await initializeSDK();
    } else {
      localStorage.removeItem('authToken');
    }
  } catch (error) {
    console.error('Auth check failed:', error);
  }
}

async function initializeSDK() {
  if (!currentUser || feedbackSDK) return;

  try {
    const urls = getProduct7BaseUrls();

    feedbackSDK = FeedbackSDK.create({
      workspace: 'zed',
      boardId: 'zed',
      userContext: currentUser
    });

    await feedbackSDK.init();

    const feedbackWidget = feedbackSDK.createWidget('button', {
      position: 'bottom-right',
      theme: 'light',
      feedbackUrl: urls.feedbackUrl,
    });
    feedbackWidget.mount();

    messengerWidget = feedbackSDK.createWidget('messenger', {
      position: 'bottom-left',
      theme: 'light',
      teamName: 'Product7 Support',
      welcomeMessage: 'How can we help you today?',
      enableHelp: true,
      enableChangelog: true,
      feedbackUrl: urls.feedbackUrl,
      changelogUrl: urls.changelogUrl,
      helpUrl: urls.helpUrl,
      roadmapUrl: urls.roadmapUrl,
    });
    messengerWidget.mount();

    console.log('Product7 SDK initialized with user:', currentUser.name);
  } catch (error) {
    console.error('SDK initialization failed:', error);
  }
}

function addToCart(product) {
  if (!currentUser) {
    alert('Please sign in to add items to cart');
    showAuthModal();
    return;
  }
  alert(`${product} added to cart`);
}

document.getElementById('authModal').addEventListener('click', (e) => {
  if (e.target.id === 'authModal') {
    hideAuthModal();
  }
});

checkAuth();