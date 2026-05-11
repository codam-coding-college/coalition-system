const toastContainer = document.getElementById('coal-toast-container');
const toastTemplate = document.getElementById('coal-toast-template');

const timeAgo = function(date) {
	if (!date) {
		return 'never';
	}

	const now = new Date();
	const diff = now.getTime() - date.getTime();
	if (diff < 0) {
		// Date is in the future!
		return timeFromNow(date);
	}
	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	const years = Math.floor(days / 365);

	if (years > 2) {
		return `${years} years ago`;
	}
	else if (days > 2) { // < 3 days we want to see the hours
		return `${days} days ago`;
	}
	else if (hours > 1) {
		return `${hours} hours ago`;
	}
	else if (minutes > 1) {
		return `${minutes} minutes ago`;
	}
	return `just now`; // don't specify: otherwise it's weird when the amount of seconds does not go up
};

const createToast = function(title, message, timestamp = new Date(), bgColor = '#0d6efd') {
	console.log('Creating toast:', { title, message, timestamp, bgColor });
	const toastElem = toastTemplate.content.cloneNode(true).querySelector('.toast');
	toastElem.style.backgroundColor = bgColor;
	toastElem.querySelector('.toast-title').textContent = title;
	toastElem.querySelector('.toast-body').textContent = message;
	toastElem.querySelector('.toast-timestamp').textContent = timeAgo(timestamp);
	const toast = new bootstrap.Toast(toastElem, { delay: 12500, autohide: true });
	toast.show();
	toastElem.addEventListener('hidden.bs.toast', function() {
		toastElem.remove();
	});
	toastContainer.appendChild(toastElem);
};
