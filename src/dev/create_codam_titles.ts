import readline from 'readline';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const main = async function(): Promise<void> {
	console.warn('Are you from the Codam (42 Amsterdam) campus? If not, please do not run this script as it is Codam-specific and may break our system on Intra.  Are you sure you want to continue? (yes/no)');
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	if (await new Promise((resolve) => {
		rl.question('', (answer) => {
			rl.close();
			resolve(answer);
		});
	}) !== 'yes') {
		console.log('Aborting...');
		process.exit(0);
	}

	const velaTitles = [
		{ ranking: 1, title: 'Captain %login (1st)', intra_title_id: 424 },
		{ ranking: 2, title: 'Commodore %login (2nd)', intra_title_id: 425 },
		{ ranking: 3, title: 'Commander %login (3rd)', intra_title_id: 426 },
		{ ranking: 4, title: 'Lieutenant %login (4th)', intra_title_id: 427 },
		{ ranking: 5, title: 'Warrant Officer %login (5th)', intra_title_id: 428 },
		{ ranking: 6, title: 'Sailing Master %login (6th)', intra_title_id: 475 },
		{ ranking: 7, title: 'First Mate %login (7th)', intra_title_id: 430 },
		{ ranking: 8, title: 'Second Mate %login (8th)', intra_title_id: 431 },
		{ ranking: 9, title: 'Third Mate %login (9th)', intra_title_id: 432 },
		{ ranking: 10, title: 'Midshipman %login (10th)', intra_title_id: 433 },
		{ ranking: 11, title: 'Chief Steward %login (11th)', intra_title_id: 434 },
		{ ranking: 12, title: 'Boatswain %login (12th)', intra_title_id: 435 },
		{ ranking: 13, title: 'Shipwright %login (13th)', intra_title_id: 436 },
		{ ranking: 14, title: 'Quartermaster %login (14th)', intra_title_id: 437 },
		{ ranking: 15, title: 'Helmsman %login (15th)', intra_title_id: 438 },
		{ ranking: 16, title: 'Skipper %login (16th)', intra_title_id: 439 },
		{ ranking: 17, title: "Ship's Corporal %login (17th)", intra_title_id: 440 },
		{ ranking: 18, title: 'Watch Captain %login (18th)', intra_title_id: 441 },
		{ ranking: 19, title: 'Privateer %login (19th)', intra_title_id: 442 },
		{ ranking: 20, title: 'Mariner %login (20th)', intra_title_id: 443 },
		{ ranking: 21, title: 'Sailmaker %login (21st)', intra_title_id: 444 },
		{ ranking: 22, title: 'Caulker %login (22nd)', intra_title_id: 445 },
		{ ranking: 23, title: 'Ropemaker %login (23rd)', intra_title_id: 446 },
		{ ranking: 24, title: "Captain's Clerk %login (24th)", intra_title_id: 447 },
		{ ranking: 25, title: "Sailing Master's Mate %login (25th)", intra_title_id: 476 },
		{ ranking: 26, title: "Midshipman's Mate %login (26th)", intra_title_id: 449 },
		{ ranking: 27, title: "Boatswain's Mate %login (27th)", intra_title_id: 450 },
		{ ranking: 28, title: "Quartermaster's Mate %login (28th)", intra_title_id: 451 },
		{ ranking: 29, title: "Sailmaker's Mate %login (29th)", intra_title_id: 452 },
		{ ranking: 30, title: "Caulker's Mate %login (30th)", intra_title_id: 453 },
		// { ranking: 31, title: "Leading Hand %login (A)", intra_title_id: 454 },
		// { ranking: 32, title: "Able Sailor %login (B)", intra_title_id: 455 },
		// { ranking: 33, title: "Ordinary Sailor %login (C)", intra_title_id: 456 },
		// { ranking: 34, title: "Swabby %login (D)", intra_title_id: 457 },
		// { ranking: 35, title: "Powder Monkey %login (E)", intra_title_id: 458 },
		// { ranking: 36, title: "Landlubber %login (F)", intra_title_id: 459 },
	];

	const pyxisTitles = [
		{ ranking: 1, title: 'Polaris %login (1st)', intra_title_id: 479 },
		{ ranking: 2, title: 'Ursa Major %login (2nd)', intra_title_id: 480 },
		{ ranking: 3, title: 'Ursa Minor %login (3rd)', intra_title_id: 481 },
		{ ranking: 4, title: 'Aries %login (4th)', intra_title_id: 482 },
		{ ranking: 5, title: 'Taurus %login (5th)', intra_title_id: 483 },
		{ ranking: 6, title: 'Gemini %login (6th)', intra_title_id: 484 },
		{ ranking: 7, title: 'Karkinos %login (7th)', intra_title_id: 485 },
		{ ranking: 8, title: 'Leo %login (8th)', intra_title_id: 486 },
		{ ranking: 9, title: 'Virgo %login (9th)', intra_title_id: 487 },
		{ ranking: 10, title: 'Libra %login (10th)', intra_title_id: 488 },
		{ ranking: 11, title: 'Scorpio %login (11th)', intra_title_id: 489 },
		{ ranking: 12, title: 'Sagittarius %login (12th)', intra_title_id: 490 },
		{ ranking: 13, title: 'Capricorn %login (13th)', intra_title_id: 491 },
		{ ranking: 14, title: 'Aquarius %login (14th)', intra_title_id: 492 },
		{ ranking: 15, title: 'Pisces %login (15th)', intra_title_id: 493 },
		{ ranking: 16, title: 'Ophiuchus %login (16th)', intra_title_id: 494 },
		{ ranking: 17, title: 'Corona Australis %login (17th)', intra_title_id: 495 },
		{ ranking: 18, title: 'Corona Borealis %login (18th)', intra_title_id: 496 },
		{ ranking: 19, title: 'Andromeda %login (19th)', intra_title_id: 497 },
		{ ranking: 20, title: 'Centauri %login (20th)', intra_title_id: 498 },
		{ ranking: 21, title: 'Cassiopeia %login (21st)', intra_title_id: 499 },
		{ ranking: 22, title: 'Cygnus %login (22nd)', intra_title_id: 500 },
		{ ranking: 23, title: 'Draco %login (23rd)', intra_title_id: 501 },
		{ ranking: 24, title: 'Hercules %login (24th)', intra_title_id: 502 },
		{ ranking: 25, title: 'Hydra %login (25th)', intra_title_id: 503 },
		{ ranking: 26, title: 'Lupus %login (26th)', intra_title_id: 504 },
		{ ranking: 27, title: 'Lyra %login (27th)', intra_title_id: 505 },
		{ ranking: 28, title: 'Orion %login (28th)', intra_title_id: 506 },
		{ ranking: 29, title: 'Pegasus %login (29th)', intra_title_id: 507 },
		{ ranking: 30, title: 'Serpens %login (30th)', intra_title_id: 508 },
		// { ranking: 31, title: "Aquila %login (A)", intra_title_id: 509 },
		// { ranking: 32, title: "Boötes %login (B)", intra_title_id: 510 },
		// { ranking: 33, title: "Corvus %login (C)", intra_title_id: 511 },
		// { ranking: 34, title: "Delphinus %login (D)", intra_title_id: 512 },
		// { ranking: 35, title: "Equuleus %login (E)", intra_title_id: 513 },
		// { ranking: 36, title: "Fornax %login (F)", intra_title_id: 514 },
	];

	const cetusTitles = [
		{ ranking: 1, title: ' %login, the true Cetus (1st)', intra_title_id: 515 },
		{ ranking: 2, title: 'Leviathan %login (2nd)', intra_title_id: 516 },
		{ ranking: 3, title: 'Kraken %login (3rd)', intra_title_id: 517 },
		{ ranking: 4, title: ' %login, the World-bearing Turtle (4th)', intra_title_id: 518 },
		{ ranking: 5, title: 'Tiamat %login (5th)', intra_title_id: 519 },
		{ ranking: 6, title: 'Nessie %login (6th)', intra_title_id: 520 },
		{ ranking: 7, title: 'Moby \'%login\' Dick (7th)', intra_title_id: 521 },
		{ ranking: 8, title: 'Umiboza %login (8th)', intra_title_id: 522 },
		{ ranking: 9, title: 'Scylla %login (9th)', intra_title_id: 523 },
		{ ranking: 10, title: '%login Willy, the free (10th)', intra_title_id: 524 },
		{ ranking: 11, title: 'Charybdis %login (11th)', intra_title_id: 525 },
		{ ranking: 12, title: '%login, The Magrathean whale (12th)', intra_title_id: 526 },
		{ ranking: 13, title: 'Yu-Kiang %login (13th)', intra_title_id: 527 },
		{ ranking: 14, title: 'Makara %login (14th)', intra_title_id: 528 },
		{ ranking: 15, title: 'Hydra %login (15th)', intra_title_id: 529 },
		{ ranking: 16, title: 'Lion Turtle %login (16th)', intra_title_id: 530 },
		{ ranking: 17, title: 'Megalodon %login (17th)', intra_title_id: 531 },
		{ ranking: 18, title: 'The Terrible Dogfish %login (18th)', intra_title_id: 532 },
		{ ranking: 19, title: 'Akhlut %login (19th)', intra_title_id: 533 },
		{ ranking: 20, title: 'Lusca %login (20th)', intra_title_id: 534 },
		{ ranking: 21, title: 'Cecaelia %login (21st)', intra_title_id: 535 },
		{ ranking: 22, title: 'Panlong %login (22nd)', intra_title_id: 536 },
		{ ranking: 23, title: 'Siren %login (23rd)', intra_title_id: 537 },
		{ ranking: 24, title: 'Selkie %login (24th)', intra_title_id: 538 },
		{ ranking: 25, title: 'Nereid %login (25th)', intra_title_id: 539 },
		{ ranking: 26, title: 'Rusalka %login (26th)', intra_title_id: 540 },
		{ ranking: 27, title: 'Kappa %login (27th)', intra_title_id: 541 },
		{ ranking: 28, title: 'Kelpie %login (28th)', intra_title_id: 542 },
		{ ranking: 29, title: 'Grindylow %login (29th)', intra_title_id: 543 },
		{ ranking: 30, title: 'Pearl \'%login\' Krabs (30th)', intra_title_id: 544 },
		// { ranking: 31, title: "Blue Whale %login (A)", intra_title_id: 545 },
		// { ranking: 32, title: "Killer Whale %login (B)", intra_title_id: 546 },
		// { ranking: 33, title: "Narwhal %login (C)", intra_title_id: 547 },
		// { ranking: 34, title: "Bottlenose Dolphin %login (D)", intra_title_id: 548 },
		// { ranking: 35, title: "Manatee %login (E)", intra_title_id: 549 },
		// { ranking: 36, title: "Bottom-feeder %login (F)", intra_title_id: 550 },
	];

	// Create vela titles
	for (const velaTitle of velaTitles) {
		await prisma.codamCoalitionTitle.upsert({
			where: {
				title: velaTitle.title,
			},
			update: {
				ranking: velaTitle.ranking,
				intra_title_id: velaTitle.intra_title_id,
			},
			create: {
				coalition_id: 60, // Codam Vela coalition ID
				ranking: velaTitle.ranking,
				title: velaTitle.title,
				intra_title_id: velaTitle.intra_title_id,
			},
		});
	}

	// Create pyxis titles
	for (const pyxisTitle of pyxisTitles) {
		await prisma.codamCoalitionTitle.upsert({
			where: {
				title: pyxisTitle.title,
			},
			update: {
				ranking: pyxisTitle.ranking,
				intra_title_id: pyxisTitle.intra_title_id,
			},
			create: {
				coalition_id: 58, // Codam Pyxis coalition ID
				ranking: pyxisTitle.ranking,
				title: pyxisTitle.title,
				intra_title_id: pyxisTitle.intra_title_id,
			},
		});
	}

	// Create cetus titles
	for (const cetusTitle of cetusTitles) {
		await prisma.codamCoalitionTitle.upsert({
			where: {
				title: cetusTitle.title,
			},
			update: {
				ranking: cetusTitle.ranking,
				intra_title_id: cetusTitle.intra_title_id,
			},
			create: {
				coalition_id: 59, // Codam Cetus coalition ID
				ranking: cetusTitle.ranking,
				title: cetusTitle.title,
				intra_title_id: cetusTitle.intra_title_id,
			},
		});
	}
};

main().then(() => {
	console.log('Titles created');
	process.exit(0);
});
