const rulesRepo = require('../repositories/rules');
const groupsRepo = require('../repositories/groups');

function getTokenValue(tokens, path) {
    const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let cur = tokens;
    for (const p of parts) {
        if (cur == null) return undefined;
        cur = cur[p];
    }
    return cur;
}

function evaluateCondition(tokens, condition) {
    const { field, operator, value } = condition;
    const actual = String(getTokenValue(tokens, field) ?? '');
    const expected = String(value ?? '');

    switch (operator) {
        case 'equals':      return actual === expected;
        case 'not_equals':  return actual !== expected;
        case 'contains':    return actual.toLowerCase().includes(expected.toLowerCase());
        case 'not_contains':return !actual.toLowerCase().includes(expected.toLowerCase());
        case 'starts_with': return actual.toLowerCase().startsWith(expected.toLowerCase());
        case 'ends_with':   return actual.toLowerCase().endsWith(expected.toLowerCase());
        case 'is_empty':    return actual === '';
        case 'is_not_empty':return actual !== '';
        default:            return false;
    }
}

function ruleMatchesPayload(rule, sourceId, eventType, tokens) {
    const sourceMatch = !rule.sourceId || rule.sourceId.toString() === sourceId.toString();
    const eventMatch  = !rule.eventType || rule.eventType === '*' || rule.eventType.toLowerCase() === eventType.toLowerCase();
    if (!sourceMatch || !eventMatch) return false;

    const conditions = rule.conditions || [];
    if (conditions.length === 0) return true;

    if (rule.conditionMode === 'or') {
        return conditions.some(c => evaluateCondition(tokens, c));
    }
    return conditions.every(c => evaluateCondition(tokens, c));
}

async function findMatchingRules(sourceId, eventType, tokens = {}) {
    const groups = await groupsRepo.findAllActive();
    const allActiveRules = await rulesRepo.findAllActive();

    const matched = [];

    for (const group of groups) {
        const groupRules = allActiveRules
            .filter(r => r.groupId === group._id.toString())
            .sort((a, b) => a.order - b.order);

        const matchingInGroup = groupRules.filter(r =>
            ruleMatchesPayload(r, sourceId, eventType, tokens)
        );

        if (matchingInGroup.length === 0) continue;

        if (group.matchMode === 'first') {
            matched.push(matchingInGroup[0]);
        } else {
            matched.push(...matchingInGroup);
        }
    }

    return matched;
}

module.exports = { findMatchingRules, ruleMatchesPayload, evaluateCondition };
