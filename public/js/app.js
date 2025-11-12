// Communication Compliance Evaluator
(function () {
  'use strict';

  // Import logger for browser environment
  // The logger should be loaded from the HTML page
  const logger = window.logger || console;

  // DOM elements
  const connectionStatus = document.getElementById('connectionStatus');
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');

  // Guidance elements
  const guidanceContent = document.getElementById('guidanceContent');

  // Score elements
  const professionalismScore = document.getElementById('professionalismScore');
  const professionalismBar = document.getElementById('professionalismBar');
  const friendlinessScore = document.getElementById('friendlinessScore');
  const friendlinessBar = document.getElementById('friendlinessBar');
  const helpfulnessScore = document.getElementById('helpfulnessScore');
  const helpfulnessBar = document.getElementById('helpfulnessBar');

  // Visual feedback elements
  const visualFeedbackContent = document.getElementById(
    'visualFeedbackContent'
  );
  const visualUpdateTime = document.getElementById('visualUpdateTime');

  // WebSocket connection
  let ws = null;
  let reconnectTimer = null;

  // Initialize WebSocket connection
  function connectWebSocket() {
    // Handle both regular browser and Zoom app environments
    const isHttps = window.location.protocol === 'https:';
    const wsProtocol = isHttps ? 'wss:' : 'ws:';

    // Use the current host for WebSocket connection
    const wsHost = window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}/`;

    logger.debug('Connecting to WebSocket:', wsUrl);

    try {
      ws = new WebSocket(wsUrl);
    } catch (error) {
      logger.error('Failed to create WebSocket:', error);
      updateConnectionStatus('error');
      return;
    }

    ws.onopen = () => {
      logger.info('WebSocket connected');
      updateConnectionStatus('connected');

      // Clear any reconnect timer
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleMessage(message);
      } catch (error) {
        logger.error('Error parsing message:', error);
      }
    };

    ws.onclose = () => {
      logger.info('WebSocket disconnected');
      updateConnectionStatus('disconnected');

      // Attempt to reconnect after 3 seconds
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connectWebSocket();
        }, 3000);
      }
    };

    ws.onerror = (error) => {
      logger.error('WebSocket error:', error);
      updateConnectionStatus('error');
    };
  }

  // Handle incoming messages
  function handleMessage(message) {
    logger.debug('Received message:', message);

    switch (message.type) {
      case 'connected':
        logger.info('Connected to server:', message.message);
        break;

      case 'meeting_started':
        logger.info('Meeting RTMS stream started');
        resetScores();
        clearGuidance();
        clearVisualFeedback();
        break;

      case 'meeting_stopped':
        logger.info('Meeting RTMS stream stopped');
        break;

      case 'evaluation_update':
        handleEvaluationUpdate(message);
        break;

      case 'visual_evaluation_update':
        handleVisualEvaluationUpdate(message);
        break;

      default:
        logger.debug('Unknown message type:', message.type);
    }
  }

  // Handle visual evaluation update
  function handleVisualEvaluationUpdate(data) {
    logger.debug('Visual evaluation update:', data);

    if (data.visualFeedback) {
      updateVisualFeedback(data.visualFeedback);
    }
  }

  // Update visual feedback display
  function updateVisualFeedback(feedbackText) {
    visualFeedbackContent.innerHTML = `<p>${escapeHtml(feedbackText)}</p>`;

    // Update timestamp
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    visualUpdateTime.querySelector('.update-value').textContent = timeString;

    // Add a subtle animation
    visualFeedbackContent.style.animation = 'none';
    setTimeout(() => {
      visualFeedbackContent.style.animation = 'fadeIn 0.5s ease-out';
    }, 10);
  }

  // Clear visual feedback
  function clearVisualFeedback() {
    visualFeedbackContent.innerHTML =
      '<p class="empty-state">Visual analysis will appear here once video is available.</p>';
    visualUpdateTime.querySelector('.update-value').textContent = '-';
  }

  // Handle evaluation update with guidance and scores
  function handleEvaluationUpdate(data) {
    logger.debug('Evaluation update:', data);

    // Update guidance
    if (data.guidance) {
      updateGuidance(data.guidance);
    }

    // Update scores
    if (data.scores) {
      updateScores(data.scores);
    }
  }

  // Update guidance display
  function updateGuidance(guidanceText) {
    guidanceContent.innerHTML = `<p>${escapeHtml(guidanceText)}</p>`;

    // Add a subtle animation
    guidanceContent.style.animation = 'none';
    setTimeout(() => {
      guidanceContent.style.animation = 'fadeIn 0.5s ease-out';
    }, 10);
  }

  // Clear guidance
  function clearGuidance() {
    guidanceContent.innerHTML =
      '<p class="empty-state">Start speaking to receive guidance on your communication style.</p>';
  }

  // Update scores display
  function updateScores(scores) {
    // Update professionalism
    if (scores.professionalism !== undefined) {
      professionalismScore.textContent = scores.professionalism;
      professionalismBar.style.width = `${scores.professionalism * 10}%`;
      professionalismBar.style.background = getScoreColor(
        scores.professionalism
      );
    }

    // Update friendliness
    if (scores.friendliness !== undefined) {
      friendlinessScore.textContent = scores.friendliness;
      friendlinessBar.style.width = `${scores.friendliness * 10}%`;
      friendlinessBar.style.background = getScoreColor(scores.friendliness);
    }

    // Update helpfulness
    if (scores.helpfulness !== undefined) {
      helpfulnessScore.textContent = scores.helpfulness;
      helpfulnessBar.style.width = `${scores.helpfulness * 10}%`;
      helpfulnessBar.style.background = getScoreColor(scores.helpfulness);
    }
  }

  // Get color based on score value (greyscale)
  function getScoreColor(score) {
    // Return solid grey color (no gradients)
    return '#666';
  }

  // Reset scores to initial state
  function resetScores() {
    professionalismScore.textContent = '-';
    professionalismBar.style.width = '0%';

    friendlinessScore.textContent = '-';
    friendlinessBar.style.width = '0%';

    helpfulnessScore.textContent = '-';
    helpfulnessBar.style.width = '0%';
  }

  // Update connection status indicator
  function updateConnectionStatus(status) {
    statusIndicator.className = `status-indicator ${status}`;

    switch (status) {
      case 'connected':
        statusText.textContent = 'Connected';
        break;
      case 'disconnected':
        statusText.textContent = 'Disconnected';
        break;
      case 'error':
        statusText.textContent = 'Connection Error';
        break;
      default:
        statusText.textContent = 'Unknown';
    }
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Add fade-in animation style
  const style = document.createElement('style');
  style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
  document.head.appendChild(style);

  // Initialize on page load
  document.addEventListener('DOMContentLoaded', () => {
    connectWebSocket();
    resetScores();
    clearVisualFeedback();
  });

  // Handle page visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      logger.debug('Page hidden');
    } else {
      logger.debug('Page visible');
      // Reconnect if needed
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        connectWebSocket();
      }
    }
  });
})();
