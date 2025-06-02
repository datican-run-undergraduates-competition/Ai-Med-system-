// Function to get user's location and update form fields
function getUserLocation() {
    // Get the latitude and longitude input fields
    const latInput = document.getElementById('lat');
    const lonInput = document.getElementById('lon');
    
    // Check if geolocation is supported by the browser
    if (!navigator.geolocation) {
        console.error('Geolocation is not supported by your browser');
        alert('Geolocation is not supported by your browser')
        return;
    }

    // Show loading state
    latInput.value = 'Getting location...';
    lonInput.value = 'Getting location...';

    // Get the current position
    navigator.geolocation.getCurrentPosition(
        // Success callback
        (position) => { 
            latInput.value = position.coords.latitude;
            lonInput.value = position.coords.longitude;
        },
        // Error callback
        (error) => {
            console.error('Error getting location:', error);
            latInput.value = '';
            lonInput.value = '';
            
            // Show error message based on error code
            let errorMessage = 'Unable to get your location. ';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += 'Please enable location access in your browser settings.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage += 'Location information is unavailable.';
                    break;
                case error.TIMEOUT:
                    errorMessage += 'Location request timed out.';
                    break;
                default:
                    errorMessage += 'An unknown error occurred.';
            }
            alert(errorMessage);
        },
        // Options
        {
            enableHighAccuracy: true, // Try to get the most accurate position
            timeout: 10000, // Wait up to 10 seconds for a response
            maximumAge: 0 // Don't use cached position
        }
    );
}

// Add event listener for when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Get the location button
    const locationButton = document.createElement('button');
    locationButton.type = 'button';
    locationButton.className = 'btn-get-location';
    locationButton.innerHTML = '<i class="fas fa-location-arrow"></i> Get Current Location';
    locationButton.onclick = getUserLocation;

    // Insert the button before the latitude input field
    const latInput = document.getElementById('lat');
    if (latInput && latInput.parentNode) {
        latInput.parentNode.insertBefore(locationButton, latInput);
    }

    // If coordinates are not set, automatically try to get location
    if (!latInput.value || !lonInput.value) {
        getUserLocation();
    }
});
