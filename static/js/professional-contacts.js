document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('professionalContactsModal');
    const btn = document.getElementById('professionalContactsBtn');
    const closeBtn = document.querySelector('.close-modal');
    const contactButtons = document.querySelectorAll('.contact-btn');

    // Open modal
    btn.addEventListener('click', function(e) {
        e.preventDefault();
        modal.style.display = 'block'; 
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    });

    // Close modal when clicking the X
    closeBtn.addEventListener('click', function() {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Restore scrolling
    });

    // Close modal when clicking outside
    window.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });

    // Handle WhatsApp redirection
    contactButtons.forEach(button => {
        button.addEventListener('click', function() {
            const card = this.closest('.contact-card');
            const whatsappNumber = card.dataset.whatsapp.trim().replace(/\D/g, ''); // Remove any non-digit characters and trim spaces
            const doctorName = card.querySelector('h3').textContent;
            const message = `Hello ${doctorName}, I would like to schedule a consultation.`;
            const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
            console.log('Opening WhatsApp URL:', whatsappUrl); // Debug log
            window.open(whatsappUrl, '_blank');
        });
    });

    // Close modal with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.style.display === 'block') {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });
}); 