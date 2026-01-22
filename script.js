const articlesData = [
  {
    type: "image",
    title: "Red Article",
    content: "This article highlights the color red.",
    image: "images/red.png"
  },
  {
    type: "pdf",
    title: "Health and Wellness",
    content: "Downloadable article in PDF format.",
    pdf: "pdfs/Health and Wellness_compressed.pdf"
  },
  {
    type: "text",
    title: "Plain Text Article",
    content: "This is a simple text-only article with no attachments."
  }
];

const articlesContainer = document.getElementById('articles');
const exploreBtn = document.getElementById('explore-btn');
const filterButtons = document.querySelectorAll('.filter-btn');
const filterContainer = document.getElementById('filter-buttons');

let articlesRendered = false;

function renderArticles(filter = 'all') {
  articlesContainer.innerHTML = ''; // Clear existing articles
  
  const filteredArticles = filter === 'all' 
    ? articlesData 
    : articlesData.filter(article => article.type === filter);

  filteredArticles.forEach((article, index) => {
    const div = document.createElement('div');
    div.classList.add('article', 'fade-in');
    div.style.animationDelay = `${index * 0.2}s`; // stagger

    let innerHTML = `<h2>${article.title}</h2>
                     <p>${article.content}</p>`;

    if (article.type === "image" && article.image) {
      innerHTML += `<img src="${article.image}" alt="${article.title}" style="max-width:100%; margin-top:1rem; border-radius:6px;">`;
    }

    if (article.type === "pdf" && article.pdf) {
        innerHTML += `<button class="cta-btn open-pdf-btn" data-pdf="${article.pdf}" style="margin-top:1rem;">View PDF</button>`;
        innerHTML += `<a href="${article.pdf}" target="_blank" download style="display:block; margin-top:1rem; color:#0066cc;">Download PDF</a>`;
    }

    div.innerHTML = innerHTML;
    articlesContainer.appendChild(div);
  });

  // Re-attach event listeners for PDF buttons
  document.querySelectorAll('.open-pdf-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pdfUrl = e.target.getAttribute('data-pdf');
      openPdfModal(pdfUrl);
    });
  });
}

exploreBtn.addEventListener('click', () => {
  articlesContainer.classList.remove('hidden');
  filterContainer.classList.remove('hidden');
  exploreBtn.classList.add('hidden'); // Hide explore button after clicking

  if (!articlesRendered) {
    renderArticles();
    articlesRendered = true;
  }
});

// Filter functionality
filterButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    // Remove active class from all buttons
    filterButtons.forEach(b => b.classList.remove('active'));
    // Add active class to clicked button
    btn.classList.add('active');
    
    const filter = btn.getAttribute('data-filter');
    renderArticles(filter);
  });
});

// PDF Modal functionality
const modal = document.getElementById('pdf-modal');
const modalEmbed = document.getElementById('pdf-modal-embed');
const closeBtn = document.querySelector('.modal-close');

function openPdfModal(pdfUrl) {
  modalEmbed.src = pdfUrl;
  modal.classList.remove('hidden');
  modal.style.display = 'flex'; // Ensure flex display for centering
}

closeBtn.addEventListener('click', () => {
  modal.classList.add('hidden');
  modal.style.display = 'none';
  modalEmbed.src = ''; // Clear src to stop loading
});

window.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
    modalEmbed.src = '';
  }
});
