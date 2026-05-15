/**
 * Bounty Issue Tracker Component for Converse.js
 * Addresses issue #2481: Good first issues, Bounties & Help wanted
 */

define(['converse-core'], function (converse) {
    const BountyTracker = {
        issues: [],
        filter: 'all',

        async fetchIssues() {
            try {
                const response = await fetch('https://api.github.com/repos/conversejs/converse.js/issues?labels=bounty&state=open');
                const data = await response.json();
                this.issues = data.map(issue => ({
                    id: issue.number,
                    title: issue.title,
                    url: issue.html_url,
                    labels: issue.labels.map(l => l.name),
                    difficulty: this.getDifficulty(issue),
                }));
            } catch (e) {
                console.error('Failed to fetch bounty issues:', e);
            }
        },

        getDifficulty(issue) {
            if (issue.labels.some(l => l.name === 'good first issue')) return 'beginner';
            if (issue.labels.some(l => l.name === 'help wanted')) return 'intermediate';
            return 'advanced';
        },

        getFiltered() {
            if (this.filter === 'all') return this.issues;
            return this.issues.filter(i => i.difficulty === this.filter);
        }
    };

    return BountyTracker;
});
