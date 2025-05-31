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

        // userInput.addEventListener('keydown', function (e) {
        //     if (e.key === 'Enter' && !e.shiftKey) {
        //         e.preventDefault();
        //         sendButton.click();
        //     }
        // });
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
    
    const icon = sendButton.querySelector('i')
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

async function sendVoiceNote(audioBlob) {
    try {
        console.log('Original audio blob:', {
            type: audioBlob.type,
            size: audioBlob.size
        });

        // Convert audio blob to WAV format if needed
        const wavBlob = audioBlob.type === 'audio/wav' ? audioBlob : await convertToWav(audioBlob);
        console.log('Converted WAV blob:', {
            type: wavBlob.type,
            size: wavBlob.size
        });
        
        const formData = new FormData();
        formData.append('voice_note', wavBlob, 'voice_note.wav');
        
        // Show loading state
        const sendIcon = document.querySelector('.send-button i');
        const sendButton = document.querySelector('.send-button');
        if (sendIcon) sendIcon.className = 'fas fa-spinner fa-spin';
        if (sendButton) sendButton.disabled = true;
        
        console.log('Sending voice note to server for transcription...');
        const response = await fetch('/diagnose/', {
            method: 'POST',
            body: formData
        });
        
        console.log('Server response status:', response.status);
        const responseText = await response.text();
        console.log('Server response text:', responseText);
        
        if (!response.ok) {
            let errorMessage;
            try {
                const errorData = JSON.parse(responseText);
                errorMessage = errorData.error || 'Network response was not ok';
            } catch (e) {
                errorMessage = `Server error: ${response.status} ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        
        const data = JSON.parse(responseText);
        console.log('Parsed response data:', data);
        
        // Create review area for transcribed text
        const reviewArea = document.createElement('div');
        reviewArea.className = 'transcription-review';
        reviewArea.innerHTML = `
            <div class="review-header">
                <h4>Review Transcription</h4>
                <button class="cancel-review" title="Cancel">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <textarea class="transcription-text" rows="3">${data.transcribed_text}</textarea>
            <div class="review-actions">
                <button class="send-transcription" title="Send">
                    <i class="fas fa-paper-plane"></i> Send
                </button>
            </div>
        `;
        
        // Hide input area and show review area
        const inputArea = document.querySelector('.input-area');
        const chatInputContainer = document.querySelector('.chat-input-container');
        if (inputArea) inputArea.style.display = 'none';
        if (chatInputContainer) chatInputContainer.insertBefore(reviewArea, inputArea);
        
        // Add event listeners for review area
        const cancelButton = reviewArea.querySelector('.cancel-review');
        const sendTranscriptionButton = reviewArea.querySelector('.send-transcription');
        const transcriptionText = reviewArea.querySelector('.transcription-text');
        
        cancelButton.addEventListener('click', () => {
            reviewArea.remove();
            if (inputArea) inputArea.style.display = 'flex';
            resetSendButton();
        });
        
        sendTranscriptionButton.addEventListener('click', async () => {
            const text = transcriptionText.value.trim();
            if (text) {
                reviewArea.remove();
                if (inputArea) inputArea.style.display = 'flex';
                await sendMessage(text);
            }
        });
        
    } catch (error) {
        console.error('Error in sendVoiceNote:', error);
        addMessage('ai', `⚠️ Error: ${error.message}`);
    } finally {
        resetSendButton();
    }
}

async function sendMessage(text) {
    const sendIcon = sendButton.querySelector('i');
    try {
        console.log('Sending message:', text);
        
        // Create FormData for multipart/form-data
        const formData = new FormData();
        formData.append('symptoms', text);
        
        // Add images if present
        if (selectedImages.length > 0) {
            selectedImages.forEach((file, index) => {
                formData.append('images', file);
            });
        }

        // Show loading state
        sendIcon.className = 'fas fa-spinner fa-spin';
        sendButton.disabled = true;
        
        // Send to backend using the new endpoint
        const response = await fetch('/process-text-message/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrftoken
            },
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Network response was not ok: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Response received:', data);
        
        // Display messages
        addMessage('user', text, selectedImages);
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
        
        // Ensure scroll to bottom
        setTimeout(() => {
            chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        }, 100);
        
    } catch (error) {
        console.error('Error:', error);
        addMessage('ai', `⚠️ Error: ${error.message}`);
    } finally {
        resetSendButton();
    }
}

function resetSendButton() {
    const sendIcon = sendButton.querySelector('i');
    sendButton.disabled = false;
    if (userInput.value.trim() === '') {
        sendIcon.className = 'fas fa-microphone';
        sendButton.title = 'Record voice note';
    } else {
        sendIcon.className = 'fas fa-paper-plane';
        sendButton.title = 'Send message';
    }
}

// Helper function to convert audio blob to WAV format
async function convertToWav(audioBlob) {
    console.log('Converting audio to WAV format...');
    
    // Create an AudioContext
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    try {
        // Read the audio blob as an ArrayBuffer
        const arrayBuffer = await audioBlob.arrayBuffer();
        console.log('Audio data loaded as ArrayBuffer');
        
        // Decode the audio data
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        console.log('Audio data decoded:', {
            numberOfChannels: audioBuffer.numberOfChannels,
            length: audioBuffer.length,
            sampleRate: audioBuffer.sampleRate
        });
        
        // Create a new AudioBuffer for the WAV
        const wavBuffer = audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            audioBuffer.length,
            audioBuffer.sampleRate
        );
        
        // Copy the audio data
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            wavBuffer.copyToChannel(audioBuffer.getChannelData(channel), channel);
        }
        
        // Convert to WAV format
        const wavBlob = await new Promise(resolve => {
            const wav = audioBufferToWav(wavBuffer);
            resolve(new Blob([wav], { type: 'audio/wav' }));
        });
        
        console.log('WAV conversion complete:', {
            type: wavBlob.type,
            size: wavBlob.size
        });
        
        return wavBlob;
    } catch (error) {
        console.error('Error converting audio to WAV:', error);
        throw new Error('Failed to convert audio to WAV format');
    } finally {
        // Close the AudioContext to free up resources
        audioContext.close();
    }
}

// Helper function to convert AudioBuffer to WAV format
function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    const dataLength = buffer.length * blockAlign;
    const bufferLength = 44 + dataLength;
    
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);
    
    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // RIFF chunk length
    view.setUint32(4, 36 + dataLength, true);
    // RIFF type
    writeString(view, 8, 'WAVE');
    // format chunk identifier
    writeString(view, 12, 'fmt ');
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (raw)
    view.setUint16(20, format, true);
    // channel count
    view.setUint16(22, numChannels, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, sampleRate * blockAlign, true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, blockAlign, true);
    // bits per sample
    view.setUint16(34, bitDepth, true);
    // data chunk identifier
    writeString(view, 36, 'data');
    // data chunk length
    view.setUint32(40, dataLength, true);
    
    // Write the PCM samples
    const offset = 44;
    const channelData = [];
    for (let i = 0; i < numChannels; i++) {
        channelData.push(buffer.getChannelData(i));
    }
    
    let pos = 0;
    for (let i = 0; i < buffer.length; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
            const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
            const value = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset + pos, value, true);
            pos += 2;
        }
    }
    
    return arrayBuffer;
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
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

function displayVoiceNote(audioUrl, transcribedText = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    
    const avatar = document.createElement('div');
    avatar.className = 'user-avatar';
    avatar.innerHTML = '<i class="fas fa-user"></i>';
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    
    const voiceNote = document.createElement('div');
    voiceNote.className = 'voice-note';
    
    // Create audio player with controls
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = audioUrl;
    audio.className = 'voice-note-player';
    audio.style.display = 'block'; // Ensure audio player is visible
    
    // Add play button
    const playButton = document.createElement('button');
    playButton.className = 'play-button';
    playButton.innerHTML = '<i class="fas fa-play"></i>';
    playButton.onclick = () => {
        if (audio.paused) {
            audio.play();
            playButton.innerHTML = '<i class="fas fa-pause"></i>';
        } else {
            audio.pause();
            playButton.innerHTML = '<i class="fas fa-play"></i>';
        }
    };
    
    // Add transcribed text if available
    if (transcribedText) {
        const textElement = document.createElement('p');
        textElement.className = 'transcribed-text';
        textElement.textContent = transcribedText;
        bubble.appendChild(textElement);
    }
    
    voiceNote.appendChild(playButton);
    voiceNote.appendChild(audio);
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
                        // Only display text messages, ignore voice note data
                        const content = chat.role === 'ai' ? formatMessage(chat.message) : chat.message;
                        addMessage(chat.role, content);
                    });

                    // Force scroll to bottom after loading messages
                    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
                }
            }
        })
        .catch(error => {
            console.error('Error loading chat history:', error);
        });
}

// Add this function to handle audio element persistence
function ensureAudioElementVisible(audioElement) {
    // Force the audio element to be visible
    audioElement.style.display = 'block';
    audioElement.style.opacity = '1';
    audioElement.style.visibility = 'visible';
    
    // Add a MutationObserver to watch for changes to the audio element
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && 
                (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
                ensureAudioElementVisible(audioElement);
            }
        });
    });
    
    // Start observing the audio element
    observer.observe(audioElement, {
        attributes: true,
        attributeFilter: ['style', 'class']
    });
    
    // Also observe the parent elements
    let parent = audioElement.parentElement;
    while (parent) {
        observer.observe(parent, {
            attributes: true,
            attributeFilter: ['style', 'class']
        });
        parent = parent.parentElement;
    }
}

// Format message with markdown-like syntax
function formatMessage(text) {
    if (!text) return '';

    // First, preserve emojis by wrapping them in spans
    let formatted = text.replace(/([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F200}-\u{1F2FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{1FAB0}-\u{1FABF}]|[\u{1FAC0}-\u{1FAFF}]|[\u{1FAD0}-\u{1FAFF}]|[\u{1FAE0}-\u{1FAFF}]|[\u{1FAF0}-\u{1FAFF}]|[\u{1FB00}-\u{1FBFF}]|[\u{1FC00}-\u{1FCFF}]|[\u{1FD00}-\u{1FDFF}]|[\u{1FE00}-\u{1FEFF}]|[\u{1FF00}-\u{1FFFF}]|[\u{20000}-\u{2A6DF}]|[\u{2A700}-\u{2B73F}]|[\u{2B740}-\u{2B81F}]|[\u{2B820}-\u{2CEAF}]|[\u{2CEB0}-\u{2EBEF}]|[\u{2F800}-\u{2FA1F}]|[\u{2FA20}-\u{2FAFF}]|[\u{2FB00}-\u{2FBFF}]|[\u{2FC00}-\u{2FCFF}]|[\u{2FD00}-\u{2FDFF}]|[\u{2FE00}-\u{2FEFF}]|[\u{2FF00}-\u{2FFFF}]|[\u{30000}-\u{3FFFD}]|[\u{40000}-\u{4FFFD}]|[\u{50000}-\u{5FFFD}]|[\u{60000}-\u{6FFFD}]|[\u{70000}-\u{7FFFD}]|[\u{80000}-\u{8FFFD}]|[\u{90000}-\u{9FFFD}]|[\u{A0000}-\u{AFFFD}]|[\u{B0000}-\u{BFFFD}]|[\u{C0000}-\u{CFFFD}]|[\u{D0000}-\u{DFFFD}]|[\u{E0000}-\u{EFFFD}]|[\u{F0000}-\u{FFFFD}]|[\u{100000}-\u{10FFFD}])/gu, '<span class="emoji">$1</span>');

    // Convert line breaks to <br>
    formatted = formatted.replace(/\n/g, '<br>');

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
function addMessage(sender, content, images = []) {
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

    // Force scroll to bottom after adding message
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

// Add this to ensure proper scrolling on window resize
window.addEventListener('resize', () => {
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
});

// Add this to ensure proper scrolling when the page loads
document.addEventListener('DOMContentLoaded', () => {
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
});

// Add toast notification function
function showToast(message, type = 'info') {
    // Create toast container if it doesn't exist
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Add toast to container
    toastContainer.appendChild(toast);
    
    // Show toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    // Remove toast after 5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 5000);
} 