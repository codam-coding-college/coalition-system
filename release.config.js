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
		"@semantic-release/github",
	]
};
