import { CodamCoalition, PrismaClient } from '@prisma/client';
import { Express } from 'express';
import { CanvasRenderingContext2D, createCanvas, loadImage, registerFont } from 'canvas';
import { CoalitionScore, getBlocAtDate, getCoalitionScore, getRanking, SingleRanking } from '../utils';

const drawUserProfilePicture = async (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, imageUrl: string | null) => {
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

export const setupBoardRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/board', async (req, res) => {
		const now = new Date();

		// DATA FETCH START
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
		});
		const rankings: { [key: string]: SingleRanking[] } = {};
		for (const rankingType of rankingTypes) {
			rankings[rankingType.type] = await getRanking(prisma, rankingType.type, now, 1);
		}

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

		// DRAWING START
		// Create canvas of 1920 x 1080
		const canvas = createCanvas(1920, 1080);
		const ctx = canvas.getContext('2d');

		// Register fonts
		registerFont('static/fonts/BebasNeue.otf', { family: 'Bebas Neue', weight: 'normal' });
		registerFont('static/fonts/MuseoSans_500.otf', { family: 'Museo Sans', weight: 'normal' });
		registerFont('static/fonts/MuseoSans_700.otf', { family: 'Museo Sans', weight: 'bold' });

		// Recurring variables for drawing
		const padding = canvas.width * 0.02;
		const overlayWidth = canvas.width * 0.05;

		// Fill background with a gradient based on the top coalition color, or with the background image of the coalition if it exists
		const topCoalitionId = parseInt(sortedCoalitionScores[0][0], 10);
		const topCoalition = coalitionsObject[topCoalitionId];
		let backgroundDrawn = false;
		if (topCoalition.intra_coalition.cover_url) {
			try {
				const backgroundImage = await loadImage(topCoalition.intra_coalition.cover_url);
				// Draw the image covering the entire canvas, like CSS background-size: cover
				const scale = Math.max(canvas.width / backgroundImage.width, canvas.height / backgroundImage.height);
				const x = (canvas.width / 2) - (backgroundImage.width / 2) * scale;
				const y = (canvas.height / 2) - (backgroundImage.height / 2) * scale;
				ctx.drawImage(backgroundImage, x, y, backgroundImage.width * scale, backgroundImage.height * scale);
				backgroundDrawn = true;
			}
			catch (error) {
				console.error('Failed to load coalition cover image, falling back to gradient:', error);
				// Fallback to gradient by not setting backgroundDrawn to true
			}
		}
		if (!backgroundDrawn) {
			const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
			gradient.addColorStop(0, (topCoalition.intra_coalition.color || '#000000'));
			gradient.addColorStop(1, '#FFFFFF');
			ctx.fillStyle = gradient;
			ctx.fillRect(0, 0, canvas.width, canvas.height);
		}

		// Draw an overlay bar on the left side, for the logo and the text "Coalition System"
		ctx.fillStyle = '#000000';
		ctx.fillRect(0, 0, overlayWidth + padding * 2, canvas.height);

		// Draw campus logo in the top left
		const image = await loadImage('static/img/logo.png');
		const imageWidth = image.width;
		const imageHeight = image.height;
		const newImageHeight = overlayWidth;
		const newImageWidth = (imageWidth / imageHeight) * newImageHeight;
		ctx.drawImage(image, padding, padding, newImageWidth, newImageHeight);

		// Draw Coalition System title under the logo, rotated 270 degrees
		// ctx.fillStyle = '#3f3f3f';
		// ctx.font = `bold ${overlayWidth}px "Bebas Neue"`;
		// ctx.save();
		// ctx.rotate(-Math.PI / 2 * 3);
		// ctx.fillText('C O A L I T I O N   S Y S T E M', newImageHeight + padding * 2, -padding - 20, canvas.height - newImageHeight - padding * 3);
		// ctx.restore();

		// Left side of the remaining space: coalition leaderboard
		const leaderboardX = overlayWidth + padding * 3;
		const leaderboardY = padding;
		const leaderboardWidth = (canvas.width - leaderboardX - padding) * 0.5;
		const leaderboardHeight = canvas.height - padding * 2;

		// Draw coalition leaderboard box
		ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
		ctx.fillRect(leaderboardX, leaderboardY, leaderboardWidth, leaderboardHeight);

		// Draw coalition leaderboard title
		ctx.fillStyle = '#000000';
		ctx.font = `bold ${Math.floor(leaderboardHeight * 0.075)}px "Bebas Neue"`;
		ctx.fillText('Coalition Leaderboard', leaderboardX + padding, leaderboardY + padding + Math.floor(leaderboardHeight * 0.06));

		// Define the height of each coalition entry
		const entryHeight = (leaderboardHeight - padding * 2.6 - Math.floor(leaderboardHeight * 0.075)) / coalitions.length;

		// Draw each coalition entry
		let currentY = leaderboardY + padding * 2 + Math.floor(leaderboardHeight * 0.075);
		let rank = 1;
		for (const [coalitionId, score] of sortedCoalitionScores) {
			const coalition = coalitionsObject[parseInt(coalitionId, 10)];

			// Draw coalition entry background
			ctx.fillStyle = coalition.intra_coalition.color || '#DDDDDD';
			ctx.fillRect(leaderboardX + padding, currentY, leaderboardWidth - padding * 2, entryHeight - padding / 2);

			// Draw position
			const textY = currentY + entryHeight * 0.5 + Math.floor(entryHeight * 0.1);
			ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
			ctx.font = `bold ${Math.floor(entryHeight)}px "Bebas Neue"`;
			ctx.fillText(`${rank}`, leaderboardX + padding + Math.floor(entryHeight * 0.05), textY + padding + Math.floor(entryHeight * 0.08));

			// Draw coalition name + points
			ctx.fillStyle = '#FFFFFF';
			ctx.font = `bold ${Math.floor(entryHeight * 0.35)}px "Museo Sans"`;
			ctx.fillText(`${coalition.intra_coalition.name}`, leaderboardX + padding * 5, textY);
			ctx.font = `bold ${Math.floor(entryHeight * 0.2)}px "Museo Sans"`;
			ctx.fillText(`${score.score} pts.`, leaderboardX + leaderboardWidth - padding * 2 - ctx.measureText(`${score.score} pts`).width, textY);

			// Draw coalition logo
			// TODO: make this work! The logos are SVG, which is not supported properly by canvas loadImage

			currentY += entryHeight;
			rank += 1;
		}

		// Right side of the remaining space: #1 of each coalition ranking
		const rankingsX = leaderboardX + leaderboardWidth + padding;
		const rankingsY = padding;
		const rankingsWidth = canvas.width - rankingsX - padding;
		const rankingsHeight = canvas.height - padding * 2;

		// Draw rankings box
		ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
		ctx.fillRect(rankingsX, rankingsY, rankingsWidth, rankingsHeight);

		// Draw rankings title
		ctx.fillStyle = '#000000';
		ctx.font = `bold ${Math.floor(rankingsHeight * 0.075)}px "Bebas Neue"`;
		ctx.fillText('Rankings', rankingsX + padding, rankingsY + padding + Math.floor(rankingsHeight * 0.06));

		// Define the height of each ranking entry
		const rankingEntryHeight = (rankingsHeight - padding * 2.6 - Math.floor(rankingsHeight * 0.075)) / rankingTypes.length;
		const rankingEntryInnerHeight = rankingEntryHeight - padding / 2;

		// Draw each ranking entry
		let currentRankingY = rankingsY + padding * 2 + Math.floor(rankingsHeight * 0.075);
		for (const rankingType of rankingTypes) {
			const rankingPadding = padding * 0.5;
			const topRanking = rankings[rankingType.type][0];
			const profilePicSize = rankingEntryInnerHeight - rankingPadding * 2;

			// Draw ranking entry background based on the top user's coalition color
			ctx.fillStyle = (topRanking && topRanking.coalition && topRanking.coalition.color ? topRanking.coalition.color : '#AAAAAA');
			ctx.fillRect(rankingsX + padding, currentRankingY, rankingsWidth - padding * 2, rankingEntryInnerHeight);
			ctx.fillStyle = 'rgba(0, 0, 0, 0.33)'; // Add some shade
			ctx.fillRect(rankingsX + padding, currentRankingY, 5, rankingEntryInnerHeight);

			// Calculate where the text should start for the entry
			const rankingEntryTextX = rankingsX + profilePicSize + rankingPadding * 4;
			// const rankingEntryTextY = currentRankingY + rankingPadding * 3;
			const rankingEntryTextY = currentRankingY + rankingEntryInnerHeight * 0.5;

			// Draw ranking entry title
			ctx.fillStyle = '#FFFFFF';
			ctx.textBaseline = 'bottom';
			ctx.font = `bold ${Math.floor(rankingEntryInnerHeight * 0.25)}px "Bebas Neue"`;
			ctx.fillText(`${rankingType.name}`, rankingEntryTextX, rankingEntryTextY);

			// Draw ranking entry text: rank, user login and score
			ctx.font = `bold ${Math.floor(rankingEntryInnerHeight * 0.2)}px "Museo Sans"`;
			ctx.textBaseline = 'top';
			if (topRanking) {
				// Draw user profile picture in the vertical center of the ranking entry
				await drawUserProfilePicture(ctx, rankingsX + padding + rankingPadding, currentRankingY + rankingPadding + (rankingEntryInnerHeight - padding) / 2 - profilePicSize / 2, profilePicSize, topRanking.user.image || '');

				// Draw login and score next to profile picture
				ctx.fillText(`${topRanking.rank}. ${topRanking.user.login} - ${topRanking.score} pts.`, rankingEntryTextX, rankingEntryTextY);
			} else {
				ctx.fillText('No data available', rankingEntryTextX, rankingEntryTextY);
			}

			ctx.textBaseline = 'alphabetic'; // Reset baseline
			currentRankingY += rankingEntryHeight;
		}


		// Draw the current bloc deadline and next bloc deadline at the bottom left
		// ctx.fillText(`Season ends: ${currentBlocDeadline ? currentBlocDeadline.end_at.toDateString() : 'N/A'}`, padding, canvas.height - 100);

		// Send the image as PNG
		res.setHeader('Content-Type', 'image/png');
		canvas.createPNGStream().pipe(res);
	});
};
