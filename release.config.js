module.exports = {
	branches: ["main"],
	plugins: [
		"@semantic-release/commit-analyzer",
		"@semantic-release/release-notes-generator",
		[
			"@semantic-release-plus/docker",
			{
				name: "ghcr.io/codam-coding-college/coalition-system",
				skipLogin: true,
			},
		],
		[
			"@semantic-release/npm",
			{
				npmPublish: false
			}
		],
		"@semantic-release/github",
		[
			"@semantic-release/git",
			{
				assets: ["package.json"],
				message: "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
			}
		]
	]
};
