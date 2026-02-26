import { IntraCoalition, PrismaClient } from '@prisma/client';
import { Express } from 'express';
import { CanvasRenderingContext2D, createCanvas, loadImage, registerFont } from 'canvas';
import { bonusPointsAwardingStarted, CoalitionScore, formatThousands, getBlocAtDate, getCoalitionScore, getCoalitionTopContributors, getRanking, SingleRanking, SMALL_CONTRIBUTION_TYPES, timeAgo } from '../utils';

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const PADDING = CANVAS_WIDTH * 0.02;
const OVERLAY_INNER_WIDTH = CANVAS_WIDTH * 0.05;
const BOTTOM_BAR_HEIGHT = PADDING * 1.5;
const BIG_BOX_HEIGHT = CANVAS_HEIGHT - PADDING * 3 - BOTTOM_BAR_HEIGHT;

const drawUserProfilePicture = async function(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, imageUrl: string | null) {
	try {
		if (!imageUrl) {
			throw new Error('No image URL provided');
		}
		const image = await loadImage(imageUrl);
		// Draw circle clip
		ctx.save();
		ctx.beginPath();
		ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2, true);
		ctx.closePath();
		ctx.clip();
		// Draw the image, make sure to cover the entire circle but remain the aspect ratio and centered. Like CSS background-size: cover.
		// ctx.drawImage(image, x, y, size, size);
		const scale = Math.max(size / image.width, size / image.height);
		const imageWidth = image.width * scale;
		const imageHeight = image.height * scale;
		const imageX = x + (size - imageWidth) / 2;
		const imageY = y + (size - imageHeight) / 2;
		ctx.drawImage(image, imageX, imageY, imageWidth, imageHeight);
		ctx.restore();
	}
	catch (error) {
		console.error('Failed to load user profile picture:', error);
		// Draw a placeholder circle
		ctx.fillStyle = '#CCCCCC';
		ctx.beginPath();
		ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2, true);
		ctx.closePath();
		ctx.fill();
	}
}

const drawCoalitionBackground = async function(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, intra_coalition: IntraCoalition) {
	let backgroundDrawn = false;
	ctx.save();
	if (intra_coalition.cover_url) {
		try {
			const backgroundImage = await loadImage(intra_coalition.cover_url);
			// Draw area clip
			ctx.beginPath();
			ctx.rect(x, y, width, height);
			ctx.closePath();
			ctx.clip();
			// Draw the image, make sure to cover the entire area but remain the aspect ratio and centered. Like CSS background-size: cover.
			const scale = Math.max(width / backgroundImage.width, height / backgroundImage.height);
			const imageWidth = backgroundImage.width * scale;
			const imageHeight = backgroundImage.height * scale;
			const imageX = x + (width - imageWidth) / 2;
			const imageY = y + (height - imageHeight) / 2;
			ctx.drawImage(backgroundImage, imageX, imageY, imageWidth, imageHeight);
			backgroundDrawn = true;
			ctx.restore();
		}
		catch (error) {
			console.error('Failed to load coalition cover image, falling back to color:', error);
			// Fallback to color by not setting backgroundDrawn to true
		}
	}
	if (!backgroundDrawn) {
		ctx.fillStyle = intra_coalition.color || '#424242';
		ctx.fillRect(x, y, width, height);
	}
	ctx.restore();
};

const initCanvas = function() {
	const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
	const ctx = canvas.getContext('2d');

	// Register fonts
	registerFont('static/fonts/bebas-neue/BebasNeue-Regular.ttf', { family: 'Bebas Neue', weight: 'normal' });
	registerFont('static/fonts/MuseoSans_500.otf', { family: 'Museo Sans', weight: 'normal' });
	registerFont('static/fonts/MuseoSans_700.otf', { family: 'Museo Sans', weight: 'bold' });

	return { canvas, ctx};
}

const drawInitialCanvas = async function(prisma: PrismaClient, ctx: CanvasRenderingContext2D) {
	// INITIAL DATA FETCH
	const now = new Date();

	// Get current bloc deadline
	const currentBlocDeadline = await getBlocAtDate(prisma, now);
	const nextBlocDeadline = await prisma.intraBlocDeadline.findFirst({
		orderBy: {
			begin_at: 'asc',
		},
		where: {
			begin_at: {
				gt: now,
			},
		},
	});

	// Get all coalitions
	const coalitions = await prisma.codamCoalition.findMany({
		select: {
			id: true,
			description: true,
			tagline: true,
			intra_coalition: {
				select: {
					id: true,
					name: true,
					color: true,
					image_url: true,
					cover_url: true,
				}
			}
		}
	});

	// Map all coalitions to their id
	const coalitionsObject: { [key: number]: typeof coalitions[0] } = {};
	for (const coalition of coalitions) {
		coalitionsObject[coalition.id] = coalition;
	}

	// Get current scores per coalition
	const coalitionScores: { [key: number]: CoalitionScore } = {};
	for (const coalition of coalitions) {
		coalitionScores[coalition.id] = await getCoalitionScore(prisma, coalition.id);
	}

	// Sort the coalitions by score
	const sortedCoalitionScores = Object.entries(coalitionScores).sort((a, b) => b[1].score - a[1].score);

	// Get the top scorer per coalition
	const topContributors: { [key: number]: SingleRanking[] } = {};
	for (const coalition of coalitions) {
		topContributors[coalition.id] = await getCoalitionTopContributors(prisma, coalition.id, 'Top 1', now, 1);
	}

	// INITIAL DRAWING START
	// Fill background with a gradient based on the top coalition color, or with the background image of the coalition if it exists
	const topCoalitionId = parseInt(sortedCoalitionScores[0][0], 10);
	const topCoalition = coalitionsObject[topCoalitionId];
	let backgroundDrawn = false;
	if (topCoalition.intra_coalition.cover_url) {
		try {
			const backgroundImage = await loadImage(topCoalition.intra_coalition.cover_url);
			// Draw the image covering the entire canvas, like CSS background-size: cover
			const scale = Math.max(CANVAS_WIDTH / backgroundImage.width, CANVAS_HEIGHT / backgroundImage.height);
			const x = (CANVAS_WIDTH / 2) - (backgroundImage.width / 2) * scale;
			const y = (CANVAS_HEIGHT / 2) - (backgroundImage.height / 2) * scale;
			ctx.drawImage(backgroundImage, x, y, backgroundImage.width * scale, backgroundImage.height * scale);
			backgroundDrawn = true;
		}
		catch (error) {
			console.error('Failed to load coalition cover image, falling back to gradient:', error);
			// Fallback to gradient by not setting backgroundDrawn to true
		}
	}
	if (!backgroundDrawn) {
		const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
		gradient.addColorStop(0, (topCoalition.intra_coalition.color || '#000000'));
		gradient.addColorStop(1, '#FFFFFF');
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
	}

	// Draw an overlay bar on the left side, for the logo and the text "Coalition System"
	ctx.fillStyle = '#000000';
	ctx.fillRect(0, 0, OVERLAY_INNER_WIDTH + PADDING * 2, CANVAS_HEIGHT);

	// Draw campus logo in the top left
	const image = await loadImage('static/img/logo.png');
	const imageWidth = image.width;
	const imageHeight = image.height;
	const newImageHeight = OVERLAY_INNER_WIDTH;
	const newImageWidth = (imageWidth / imageHeight) * newImageHeight;
	ctx.drawImage(image, PADDING, PADDING, newImageWidth, newImageHeight);

	// Draw a QR code to the Coalition System home page at the bottom left
	const qrCodeImage = await loadImage('static/img/qr.png');
	const qrCodeSize = OVERLAY_INNER_WIDTH + PADDING * 2; // same width as the overlay
	ctx.imageSmoothingEnabled = false;
	ctx.drawImage(qrCodeImage, 0, CANVAS_HEIGHT - qrCodeSize, qrCodeSize, qrCodeSize);
	ctx.imageSmoothingEnabled = true;
	// Invert the QR code to make its background black
	ctx.globalCompositeOperation = 'difference';
	ctx.fillStyle = '#FFFFFF';
	ctx.fillRect(0, CANVAS_HEIGHT - qrCodeSize, qrCodeSize, qrCodeSize);
	ctx.globalCompositeOperation = 'source-over';
	// Draw text "Scan me!" above the QR code
	ctx.fillStyle = '#9A9A9A';
	ctx.textAlign = 'center';
	ctx.font = `bold ${Math.floor(PADDING * 0.8)}px "Bebas Neue"`;
	ctx.fillText('SCAN FOR MORE', qrCodeSize / 2, CANVAS_HEIGHT - qrCodeSize - PADDING * 0.1);
	ctx.textAlign = 'start'; // Reset alignment

	// Bottom bar: a progress bar indicating time left until the end of the current bloc
	const bottombarX = OVERLAY_INNER_WIDTH + PADDING * 3;
	const bottombarY = CANVAS_HEIGHT - BOTTOM_BAR_HEIGHT - PADDING;
	ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
	ctx.fillRect(bottombarX, bottombarY, CANVAS_WIDTH - bottombarX - PADDING, BOTTOM_BAR_HEIGHT);

	// Draw season progress bar
	ctx.fillStyle = '#FFFFFF';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	let progressBarText = '';
	const bottombarTextY = bottombarY + BOTTOM_BAR_HEIGHT / 2;
	if (currentBlocDeadline) {
		const totalTime = currentBlocDeadline.end_at.getTime() - currentBlocDeadline.begin_at.getTime();
		const timePassed = now.getTime() - currentBlocDeadline.begin_at.getTime();
		const progress = Math.min(Math.max(timePassed / totalTime, 0), 1);
		const barHeight = PADDING * 1.5;
		ctx.fillStyle = topCoalition.intra_coalition.color || '#424242';
		ctx.fillRect(bottombarX, bottombarY, (CANVAS_WIDTH - bottombarX - PADDING) * progress, barHeight);

		// Draw text indicating time left until the end of the current bloc
		const timeLeft = currentBlocDeadline.end_at.getTime() - now.getTime();
		const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
		const totalHoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
		ctx.fillStyle = '#FFFFFF';
		progressBarText += `Season ends in `;
		if (daysLeft > 2) {
			progressBarText += `${daysLeft} days`;
		}
		else {
			progressBarText += `${totalHoursLeft} hours`;
		}

		// Check if bonus points awarding for rankings has started (7 days prior to end of the bloc)
		const bonusPointsAwarding = await bonusPointsAwardingStarted(prisma, now);
		if (bonusPointsAwarding.started) {
			progressBarText += ` / Bonus points for rankings are currently being awarded!`;
		}
	}
	else if (nextBlocDeadline) {
		// Draw text indicating when the next bloc starts
		const timeUntil = nextBlocDeadline.begin_at.getTime() - now.getTime();
		const daysUntil = Math.floor(timeUntil / (1000 * 60 * 60 * 24));
		const hoursUntil = Math.floor((timeUntil % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
		ctx.fillStyle = '#FFFFFF';
		progressBarText = `Next season starts in ${daysUntil} days & ${hoursUntil} hours`;
	}
	else {
		progressBarText = 'No upcoming season scheduled';
	}
	ctx.fillText(progressBarText, bottombarX + (CANVAS_WIDTH - bottombarX - PADDING) / 2, bottombarTextY);
	ctx.textBaseline = 'alphabetic'; // Reset baseline
	ctx.textAlign = 'start'; // Reset alignment

	// Left side of the remaining space: coalition leaderboard
	const leaderboardX = OVERLAY_INNER_WIDTH + PADDING * 3;
	const leaderboardY = PADDING;
	const leaderboardWidth = (CANVAS_WIDTH - leaderboardX - PADDING) * 0.5;

	// Draw coalition leaderboard box
	ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
	ctx.fillRect(leaderboardX, leaderboardY, leaderboardWidth, BIG_BOX_HEIGHT);

	// Draw coalition leaderboard title
	ctx.fillStyle = '#FFFFFF';
	ctx.font = `bold ${Math.floor(BIG_BOX_HEIGHT * 0.075)}px "Bebas Neue"`;
	ctx.fillText('Coalition Leaderboard', leaderboardX + PADDING, leaderboardY + PADDING + Math.floor(BIG_BOX_HEIGHT * 0.06));

	// Define the height of each coalition entry
	const entryHeight = (BIG_BOX_HEIGHT - PADDING * 2.6 - Math.floor(BIG_BOX_HEIGHT * 0.075)) / coalitions.length;

	// Draw each coalition entry
	let currentY = leaderboardY + PADDING * 2 + Math.floor(BIG_BOX_HEIGHT * 0.075);
	let rank = 1;
	for (const [coalitionId, score] of sortedCoalitionScores) {
		const coalition = coalitionsObject[parseInt(coalitionId, 10)];

		// Draw coalition entry background
		// @ts-ignore
		await drawCoalitionBackground(ctx, leaderboardX + PADDING, currentY, leaderboardWidth - PADDING * 2, entryHeight - PADDING / 2, coalition.intra_coalition);

		// Draw position on the right of the entry
		const positionY = currentY + entryHeight * 0.5;
		ctx.fillStyle = 'rgba(255, 255, 255, 0.33)';
		ctx.font = `bold ${Math.floor(entryHeight)}px "Bebas Neue"`;
		ctx.textBaseline = 'middle';
		ctx.textAlign = 'right';
		ctx.fillText(`${rank}`, leaderboardX + leaderboardWidth - PADDING * 2, positionY);
		ctx.textAlign = 'start'; // Reset alignment

		// Draw coalition name + points
		const textX = leaderboardX + PADDING * 2;
		const textY = positionY;

		ctx.fillStyle = '#FFFFFF';
		ctx.font = `bold ${Math.floor(entryHeight * 0.28)}px "Museo Sans"`;
		ctx.textBaseline = 'alphabetic';
		ctx.fillText(`${coalition.intra_coalition.name} `, textX, textY - entryHeight * 0.15);
		const nameWidth = ctx.measureText(`${coalition.intra_coalition.name} `).width;
		ctx.font = `bold ${Math.floor(entryHeight * 0.18)}px "Museo Sans"`;
		ctx.fillText(`${formatThousands(score.score)} pts.`, textX + nameWidth, textY - entryHeight * 0.15);

		// Draw coalition logo
		// TODO: make this work! The logos are SVG, which is not supported properly by canvas loadImage

		// Draw coalition top contributor
		if (topContributors[coalition.id].length > 0) {
			const topContributor = topContributors[coalition.id][0];
			const profilePicX = textX;
			const profilePicY = textY - entryHeight * 0.05;
			const profilePicSize = entryHeight * 0.33;

			// Draw profile picture
			await drawUserProfilePicture(ctx, profilePicX, profilePicY, profilePicSize, topContributor.user.image || '');

			// Draw "TOP CONTRIBUTOR" text
			ctx.font = `bold ${Math.floor(entryHeight * 0.1)}px "Bebas Neue"`;
			ctx.textBaseline = 'bottom';
			ctx.fillText('TOP CONTRIBUTOR', profilePicX + profilePicSize + PADDING * 0.5, profilePicY + profilePicSize * 0.47);

			// Draw login and score next to profile picture
			ctx.font = `${Math.floor(entryHeight * 0.11)}px "Museo Sans"`;
			ctx.textBaseline = 'middle';
			ctx.fillText(`${(topContributor.user.login)}`, profilePicX + profilePicSize + PADDING * 0.5, profilePicY + profilePicSize * 0.62);
		}

		ctx.textBaseline = 'alphabetic'; // Reset baseline
		currentY += entryHeight;
		rank += 1;
	}

	return { leaderboardX, leaderboardWidth };
}

export const setupCanvasRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/canvas', (req, res) => {
		res.redirect('/canvas/rankings');
	});

	app.get('/canvas/rankings', async (req, res) => {
		try {
			const now = new Date();

			// DATA FETCH START
			// Get rankings
			const rankingTypes = await prisma.codamCoalitionRanking.findMany({
				select: {
					type: true,
					name: true,
					description: true,
				},
				orderBy: {
					type: 'asc',
				},
				where: {
					disabled: false,
				}
			});
			const rankings: { [key: string]: SingleRanking[] } = {};
			for (const rankingType of rankingTypes) {
				rankings[rankingType.type] = await getRanking(prisma, rankingType.type, now, 5); // Get a maximum of 5 users per ranking type to be safe, in case of ties at the top rank
			}

			// DRAWING START
			const { canvas, ctx } = initCanvas();

			// Draw initial canvas (background, left overlay, bottom bar, coalition leaderboard)
			const { leaderboardX, leaderboardWidth } = await drawInitialCanvas(prisma, ctx);

			// Right side of the remaining space: #1 of each coalition ranking
			const rightX = leaderboardX + leaderboardWidth + PADDING;
			const rightY = PADDING;
			const rightWidth = CANVAS_WIDTH - rightX - PADDING;

			// Draw right side box
			ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
			ctx.fillRect(rightX, rightY, rightWidth, BIG_BOX_HEIGHT);

			// Draw right side title
			ctx.fillStyle = '#FFFFFF';
			ctx.font = `bold ${Math.floor(BIG_BOX_HEIGHT * 0.075)}px "Bebas Neue"`;
			ctx.fillText('Individual Rankings', rightX + PADDING, rightY + PADDING + Math.floor(BIG_BOX_HEIGHT * 0.06));

			// Define the height of each ranking entry
			const entryHeight = (BIG_BOX_HEIGHT - PADDING * 2.6 - Math.floor(BIG_BOX_HEIGHT * 0.075)) / rankingTypes.length;
			const entryInnerHeight = entryHeight - PADDING / 2;

			// Draw each ranking entry
			let currentY = rightY + PADDING * 2 + Math.floor(BIG_BOX_HEIGHT * 0.075);
			for (const rankingType of rankingTypes) {
				const entryPadding = PADDING * 0.5;
				const profilePicSize = entryInnerHeight - entryPadding * 2;

				// Check how many people hold the #1 spot
				const topRankings = rankings[rankingType.type].filter(r => r.rank === 1);
				let fillColor = '#424242'; // Base fill color if multiple coalitions share #1 spot or no data
				// Fill color based on the coalition color if there is only one #1 and that user has a coalition with a color
				if (topRankings.length === 1 && topRankings[0].coalition && topRankings[0].coalition.color) {
					fillColor = topRankings[0].coalition.color;
				}
				// Fill color based on the coalition color if there are more users in the #1 spot but they all share the same coalition
				else if (topRankings.length > 1) {
					const coalitionIds = new Set(topRankings.map(r => r.coalition ? r.coalition.id : null));
					if (coalitionIds.size === 1) {
						const coalition = topRankings[0].coalition;
						if (coalition && coalition.color) {
							fillColor = coalition.color;
						}
					}
				}

				// Draw entry background based on the top user's coalition color
				ctx.fillStyle = fillColor;
				ctx.fillRect(rightX + PADDING, currentY, rightWidth - PADDING * 2, entryInnerHeight);
				ctx.fillStyle = 'rgba(0, 0, 0, 0.33)'; // Add some shade
				ctx.fillRect(rightX + PADDING, currentY, 5, entryInnerHeight);

				// Calculate where the text should start for the entry
				const entryTextX = rightX + PADDING + entryPadding + profilePicSize + entryPadding;
				const entryTextY = currentY + entryInnerHeight * 0.5;
				const entryTextMaxWidth = rightWidth - PADDING * 2 - profilePicSize - entryPadding * 3;
				const profilePicOffset = profilePicSize * 0.75; // X offset per drawn profile picture

				// Draw entry title
				ctx.fillStyle = '#FFFFFF';
				ctx.textBaseline = 'bottom';
				ctx.font = `bold ${Math.floor(entryInnerHeight * 0.25)}px "Bebas Neue"`;
				ctx.fillText(`#1 ${rankingType.name}`, entryTextX + profilePicOffset * (Math.max(1, topRankings.length) - 1), entryTextY, entryTextMaxWidth);

				// Draw entry text: rank, user login and score
				ctx.font = `bold ${Math.floor(entryInnerHeight * 0.2)}px "Museo Sans"`;
				ctx.textBaseline = 'top';
				if (topRankings.length > 0) {
					const entryTextContent = topRankings.map(r => `${r.user.login}`).join(' & ') + ' / ' + `${formatThousands(topRankings[0].score)} pts.`;
					for (let i = 0; i < topRankings.length; i++) {
						const topRanking = topRankings[i];
						// Draw user profile picture in the vertical center of the entry
						await drawUserProfilePicture(ctx, rightX + PADDING + entryPadding + profilePicOffset * i, currentY + entryPadding, profilePicSize, topRanking.user.image || '');
					}
					ctx.fillText(entryTextContent, entryTextX + profilePicOffset * (topRankings.length - 1), entryTextY, entryTextMaxWidth);
				}
				else {
					ctx.fillText('No data available', entryTextX, entryTextY, entryTextMaxWidth);
				}

				ctx.textBaseline = 'alphabetic'; // Reset baseline
				currentY += entryHeight;
			}

			// Send the image as PNG
			res.setHeader('Content-Type', 'image/png');
			canvas.createPNGStream().pipe(res);
		}
		catch (err) {
			console.error('Error generating board image:', err);
			return res.status(500).send('Internal Server Error');
		}
	});

	app.get('/canvas/activity', async (req, res) => {
		try {
			const now = new Date();

			// DATA FETCH START
			// Get recent big contributions
			const latestBigScores = await prisma.codamCoalitionScore.findMany({
				where: {
					OR: [
						{
							NOT: {
								fixed_type_id: {
									in: SMALL_CONTRIBUTION_TYPES, // Exclude usually low individual scores
								}
							},
						},
						{
							fixed_type_id: null, // Do include scores that are not fixed types
						}
					],
					amount: {
						gt: 0,
					},
				},
				orderBy: {
					created_at: 'desc',
				},
				include: {
					user: {
						select: {
							intra_user: {
								select: {
									login: true,
									image: true,
								},
							},
						},
					},
					coalition: {
						select: {
							intra_coalition: {
								select: {
									name: true,
									color: true,
								},
							},
						},
					},
				},
				take: 7,
			});

			// DRAWING START
			const { canvas, ctx } = initCanvas();

			// Draw initial canvas (background, left overlay, bottom bar, coalition leaderboard)
			const { leaderboardX, leaderboardWidth } = await drawInitialCanvas(prisma, ctx);

			// Right side of the remaining space: #1 of each coalition ranking
			const rightX = leaderboardX + leaderboardWidth + PADDING;
			const rightY = PADDING;
			const rightWidth = CANVAS_WIDTH - rightX - PADDING;

			// Draw right side box
			ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
			ctx.fillRect(rightX, rightY, rightWidth, BIG_BOX_HEIGHT);

			// Draw right side title
			ctx.fillStyle = '#FFFFFF';
			ctx.font = `bold ${Math.floor(BIG_BOX_HEIGHT * 0.075)}px "Bebas Neue"`;
			ctx.fillText('Recent big contributions', rightX + PADDING, rightY + PADDING + Math.floor(BIG_BOX_HEIGHT * 0.06));

			// Define the height of each score entry
			const entryHeight = (BIG_BOX_HEIGHT - PADDING * 2.6 - Math.floor(BIG_BOX_HEIGHT * 0.075)) / latestBigScores.length;
			const entryInnerHeight = entryHeight - PADDING / 2;

			// Draw each score entry
			let currentY = rightY + PADDING * 2 + Math.floor(BIG_BOX_HEIGHT * 0.075);
			for (const score of latestBigScores) {
				const entryPadding = PADDING * 0.33;
				const profilePicSize = entryInnerHeight - entryPadding * 2;

				// Draw entry background based on the user's coalition color
				ctx.fillStyle = (score && score.coalition.intra_coalition.color ? score.coalition.intra_coalition.color : '#424242');
				ctx.fillRect(rightX + PADDING, currentY, rightWidth - PADDING * 2, entryInnerHeight);
				ctx.fillStyle = 'rgba(0, 0, 0, 0.33)'; // Add some shade
				ctx.fillRect(rightX + PADDING, currentY, 5, entryInnerHeight);

				// Calculate where the text should start for the entry
				const entryTextX = rightX + PADDING + entryPadding + profilePicSize + entryPadding;
				const entryTextY = currentY + entryInnerHeight * 0.5;
				const entryTextMaxWidth = rightWidth - PADDING * 2 - profilePicSize - entryPadding * 3;

				// Draw entry title: login, score amount and time ago
				ctx.fillStyle = '#FFFFFF';
				ctx.textBaseline = 'bottom';
				ctx.font = `bold ${Math.floor(entryInnerHeight * 0.21)}px "Museo Sans"`;
				ctx.fillText(`${score.user.intra_user.login} / ${formatThousands(score.amount)} pts. / ${timeAgo(score.created_at)}`, entryTextX, entryTextY, entryTextMaxWidth);

				// Draw user profile picture in the vertical center of the entry
				await drawUserProfilePicture(ctx, rightX + PADDING + entryPadding, currentY + entryPadding, profilePicSize, score.user.intra_user.image || '');

				// Draw score reason next to profile picture
				ctx.textBaseline = 'top';
				ctx.font = `${Math.floor(entryInnerHeight * 0.21)}px "Museo Sans"`;
				ctx.fillText(`${score.reason}`, entryTextX, entryTextY, entryTextMaxWidth);

				ctx.textBaseline = 'alphabetic'; // Reset baseline
				currentY += entryHeight;
			}

			// Send the image as PNG
			res.setHeader('Content-Type', 'image/png');
			canvas.createPNGStream().pipe(res);
		}
		catch (err) {
			console.error('Error generating board image:', err);
			return res.status(500).send('Internal Server Error');
		}
	});
};
