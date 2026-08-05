module.exports = {
	branches: ["main"],
	plugins: [
		"@semantic-release/commit-analyzer",
		"@semantic-release/release-notes-generator",
		[
			"@semantic-release/exec",
			{
				publishCmd: 'docker tag ghcr.io/codam-coding-college/peerpp-bot ghcr.io/codam-coding-college/peerpp-bot:${nextRelease.version} && docker push ghcr.io/codam-coding-college/peerpp-bot:${nextRelease.version}'
			}
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
