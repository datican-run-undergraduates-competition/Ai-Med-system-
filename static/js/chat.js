/**
 * AI Medical Chat Interface
 * Handles message rendering, animations, and API interactions with Gemini
 */

// Global variables
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let selectedImages = [];
let chatMessagesContainer;
let sendButton;
let userInput;
let csrftoken;
let imagePreview;

// Get CSRF token for Django
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

document.addEventListener('DOMContentLoaded', function () {
    // DOM elements
    userInput = document.getElementById('user-input');
    sendButton = document.getElementById('send-button');
    chatMessagesContainer = document.getElementById('chat-messages-chat');
    const suggestionButtons = document.querySelectorAll('.suggestion-btn');
    const recentChatsContainer = document.getElementById('recent-chats');
    const attachmentButton = document.getElementById('attachment-button');
    const imageUpload = document.getElementById('image-upload');
    imagePreview = document.getElementById('image-preview');

    // Get CSRF token
    csrftoken = getCookie('csrftoken');

    // Setup event listeners
    console.log('Setting up event listeners');
    
    // Send button click handler
    if (sendButton) {
        sendButton.addEventListener('click', async (e) => {
            console.log('Send button clicked');
            const currentText = userInput.value.trim();
            
            // If there's text, send the text message
            if (currentText !== '') {
                console.log('Sending text message');
                // Show loading state
                const sendIcon = sendButton.querySelector('i');
                sendIcon.className = 'fas fa-spinner fa-spin';
                sendButton.disabled = true;
                
                try {
                    await sendMessage(currentText);
                } catch (error) {
                    console.error('Error:', error);
                    // Reset button state on error
                    sendIcon.className = 'fas fa-paper-plane';
                    sendButton.disabled = false;
                    addMessage('ai', `⚠️ Error: ${error.message}`);
                }
            } else if (!isRecording) {
                // Only start recording if there's no text and not already recording
                console.log('Starting recording');
                await startRecording();
            } else {
                console.log('Stopping recording');
                stopRecording();
            }
        });
    }

    // Attachment button click handler
    if (attachmentButton) {
        attachmentButton.addEventListener('click', (e) => {
            console.log('Attachment button clicked');
            e.preventDefault();
            imageUpload.click();
        });
    }
    
    // Image upload handler
    if (imageUpload) {
        imageUpload.addEventListener('change', (e) => {
            console.log('Image upload changed:', e.target.files);
            handleImageUpload(e);
        });
    }
    
    // Input change handler for icon switching
    if (userInput) {
        userInput.addEventListener('input', handleInputChange);

        userInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendButton.click();
            }
        });
    }

    // Suggestion button clicks
    suggestionButtons.forEach(button => {
        button.addEventListener('click', function () {
            if (userInput) {
                userInput.value = this.textContent;
                handleInputChange(); // Update icon immediately
                sendButton.click();
            }
        });
    });

    // Check media recorder support
    checkMediaRecorderSupport();

    // Initial setup
    loadChatHistory();
});

function handleInputChange() {
    console.log('Handling input change');
    if (!sendButton || !userInput) return;
    
    const icon = sendButton.querySelector('i');
    const currentText = userInput.value.trim();
    console.log('Current text:', currentText);
    
    if (currentText !== '') {
        console.log('Changing to send icon');
        icon.className = 'fas fa-paper-plane';
        sendButton.title = 'Send message';
        // Remove recording class if it exists
        sendButton.classList.remove('recording');
        // Stop recording if it's in progress
        if (isRecording) {
            stopRecording();
        }
    } else {
        console.log('Changing to microphone icon');
        icon.className = 'fas fa-microphone';
        sendButton.title = 'Record voice note';
    }
}

async function handleSendButtonClick() {
    console.log('Handling send button click');
    const currentText = userInput.value.trim();
    
    // If there's text, always send the text message
    if (currentText !== '') {
        console.log('Sending text message');
        // Show loading state
        const sendIcon = sendButton.querySelector('i');
        sendIcon.className = 'fas fa-spinner fa-spin';
        sendButton.disabled = true;
        
        try {
            await sendMessage(currentText);
        } catch (error) {
            console.error('Error:', error);
            // Reset button state on error
            sendIcon.className = 'fas fa-paper-plane';
            sendButton.disabled = false;
            alert('Error sending message: ' + error.message);
        }
        return; // Exit early after sending text message
    }
    
    // Only handle recording if there's no text
    if (!isRecording) {
        console.log('Starting recording');
        await startRecording();
    } else {
        console.log('Stopping recording');
        stopRecording();
    }
}

async function startRecording() {
    console.log('Starting recording process');
    try {
        console.log('Requesting microphone access');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('Microphone access granted');
        
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            console.log('Data available from recorder');
            audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = async () => {
            console.log('Recording stopped, processing audio');
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            await sendVoiceNote(audioBlob);
        };
        
        mediaRecorder.start();
        console.log('MediaRecorder started');
        isRecording = true;
        sendButton.classList.add('recording');
        sendButton.querySelector('i').className = 'fas fa-stop';
    } catch (error) {
        console.error('Error accessing microphone:', error);
        alert('Unable to access microphone. Please check your permissions.');
    }
}

function stopRecording() {
    console.log('Stopping recording');
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        sendButton.classList.remove('recording');
        sendButton.querySelector('i').className = 'fas fa-microphone';
        
        // Stop all audio tracks
        mediaRecorder.stream.getTracks().forEach(track => {
            console.log('Stopping audio track');
            track.stop();
        });
    }
}

function handleImageUpload(event) {
    console.log('Handling image upload');
    const files = event.target.files;
    console.log('Files selected:', files);
    
    for (let file of files) {
        console.log('Processing file:', file.name, file.type);
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                console.log('File read complete');
                addImagePreview(e.target.result, file);
            };
            reader.readAsDataURL(file);
        } else {
            console.log('Invalid file type:', file.type);
        }
    }
    // Reset the input to allow selecting the same file again
    event.target.value = '';
}

function addImagePreview(src, file) {
    console.log('Adding image preview');
    const previewItem = document.createElement('div');
    previewItem.className = 'image-preview-item';
    
    const img = document.createElement('img');
    img.src = src;
    
    const removeButton = document.createElement('button');
    removeButton.className = 'remove-image';
    removeButton.innerHTML = '×';
    removeButton.onclick = () => {
        console.log('Removing image preview');
        previewItem.remove();
        selectedImages = selectedImages.filter(f => f !== file);
    };
    
    previewItem.appendChild(img);
    previewItem.appendChild(removeButton);
    imagePreview.appendChild(previewItem);
    selectedImages.push(file);
    console.log('Image preview added, total images:', selectedImages.length);
}

async function sendMessage(text) {
    const sendIcon = sendButton.querySelector('i');
    try {
        console.log('Sending message:', text);
        
        // Create the request data in the format your view expects
        const requestData = {
            symptoms: text
        };

        // Show loading state
        sendIcon.className = 'fas fa-spinner fa-spin';
        sendButton.disabled = true;
        
        // Send to backend
        const response = await fetch('/diagnose/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Network response was not ok: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Response received:', data);
        
        // Display messages
        addMessage('user', text);
        if (data.answer) {
            addMessage('ai', formatMessage(data.answer));
        } else if (data.error) {
            addMessage('ai', `⚠️ Error: ${data.error}`);
        }
        
        // Clear input and previews
        userInput.value = '';
        if (imagePreview) {
            imagePreview.innerHTML = '';
        }
        selectedImages = [];
        
    } catch (error) {
        console.error('Error:', error);
        addMessage('ai', `⚠️ Error: ${error.message}`);
    } finally {
        // Reset button state
        sendButton.disabled = false;
        // Reset icon based on input state
        if (userInput.value.trim() === '') {
            sendIcon.className = 'fas fa-microphone';
            sendButton.title = 'Record voice note';
        } else {
            sendIcon.className = 'fas fa-paper-plane';
            sendButton.title = 'Send message';
        }
    }
}

async function sendVoiceNote(audioBlob) {
    try {
        const formData = new FormData();
        formData.append('voice_note', audioBlob, 'voice_note.wav');
        
        // Show loading state
        const sendIcon = sendButton.querySelector('i');
        sendIcon.className = 'fas fa-spinner fa-spin';
        sendButton.disabled = true;
        
        const response = await fetch('/diagnose/', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        const data = await response.json();
        
        // Display voice note in chat
        displayVoiceNote(audioBlob);
        // Display AI response
        displayMessage(data.answer, 'ai');
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error sending voice note. Please try again.');
    } finally {
        // Reset button state
        const sendIcon = sendButton.querySelector('i');
        sendIcon.className = 'fas fa-microphone';
        sendButton.disabled = false;
    }
}

function displayMessage(text, type, images = []) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const avatar = document.createElement('div');
    avatar.className = type === 'ai' ? 'ai-avatar' : 'user-avatar';
    avatar.innerHTML = `<i class="fas fa-${type === 'ai' ? 'robot' : 'user'}"></i>`;
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    
    // Add text if present
    if (text) {
        const textElement = document.createElement('p');
        textElement.textContent = text;
        bubble.appendChild(textElement);
    }
    
    // Add images if present
    if (images.length > 0) {
        const imagesContainer = document.createElement('div');
        imagesContainer.className = 'message-images';
        images.forEach(file => {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.className = 'message-image';
            imagesContainer.appendChild(img);
        });
        bubble.appendChild(imagesContainer);
    }
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(bubble);
    
    document.getElementById('chat-messages-chat').appendChild(messageDiv);
    messageDiv.scrollIntoView({ behavior: 'smooth' });
}

function displayVoiceNote(audioBlob) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    
    const avatar = document.createElement('div');
    avatar.className = 'user-avatar';
    avatar.innerHTML = '<i class="fas fa-user"></i>';
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    
    const voiceNote = document.createElement('div');
    voiceNote.className = 'voice-note';
    voiceNote.innerHTML = `
        <i class="fas fa-play"></i>
        <span class="duration">Voice Note</span>
    `;
    
    voiceNote.onclick = () => {
        const audio = new Audio(URL.createObjectURL(audioBlob));
        audio.play();
    };
    
    bubble.appendChild(voiceNote);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(bubble);
    
    document.getElementById('chat-messages-chat').appendChild(messageDiv);
    messageDiv.scrollIntoView({ behavior: 'smooth' });
}

function checkMediaRecorderSupport() {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
        sendButton.style.display = 'none';
        alert('Voice recording is not supported in your browser.');
    }
}

function loadChatHistory() {
    console.log('Loading chat history...');
    fetch('/get-chat-history/')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log('Chat history data:', data);
            if (data.chat_history && data.chat_history.length > 0) {
                // Clear any default welcome message
                if (chatMessagesContainer) {
                    chatMessagesContainer.innerHTML = '';

                    data.chat_history.forEach(chat => {
                        // Apply formatting to AI messages, leave user messages as is
                        const content = chat.role === 'ai' ? formatMessage(chat.message) : chat.message;
                        addMessage(chat.role, content);
                    });

                    // Scroll to the bottom after loading messages
                    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
                }
            }
        })
        .catch(error => {
            console.error('Error loading chat history:', error);
        });
}

// Format message with markdown-like syntax
function formatMessage(text) {
    if (!text) return '';

    // Convert line breaks to <br>
    let formatted = text.replace(/\n/g, '<br>');

    // Bold text between double asterisks
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Italic text between single asterisks
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Process bullet points (lines starting with - or •)
    let lines = formatted.split('<br>');
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().match(/^[-•] /)) {
            // If this is the first bullet point, start a list
            if (!inList) {
                lines[i] = '<ul><li>' + lines[i].trim().substring(2) + '</li>';
                inList = true;
            } else {
                lines[i] = '<li>' + lines[i].trim().substring(2) + '</li>';
            }

            // If the next line is not a bullet point or it's the last line, close the list
            if (i === lines.length - 1 || !lines[i + 1].trim().match(/^[-•] /)) {
                lines[i] = lines[i] + '</ul>';
                inList = false;
            }
        } else if (inList) {
            // If we're in a list but this line is not a bullet point, close the list
            lines[i - 1] = lines[i - 1] + '</ul>';
            inList = false;
        }
    }

    formatted = lines.join('<br>');

    // Fix any potentially remaining unclosed lists
    if (inList) {
        formatted = formatted + '</ul>';
    }

    return formatted;
}

// Add message to chat UI
function addMessage(sender, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = sender === 'user' ? 'user-message' : 'ai-message';

    const avatar = document.createElement('div');
    avatar.className = sender === 'user' ? 'user-avatar' : 'ai-avatar';

    const icon = document.createElement('i');
    icon.className = sender === 'user' ? 'fas fa-user' : 'fas fa-robot';
    avatar.appendChild(icon);

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.innerHTML = content;

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);

    chatMessagesContainer.appendChild(messageDiv);

    // Scroll to bottom
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
} 