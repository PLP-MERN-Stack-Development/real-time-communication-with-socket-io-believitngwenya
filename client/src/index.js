// Request notification permission
useEffect(() => {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}, []);

// Show notification for new messages
useEffect(() => {
  if (messages.length > 0 && document.hidden) {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.type !== 'system' && lastMessage.username !== user?.username) {
      new Notification(`New message from ${lastMessage.username}`, {
        body: lastMessage.content,
        icon: lastMessage.avatar
      });
    }
  }
}, [messages]);

