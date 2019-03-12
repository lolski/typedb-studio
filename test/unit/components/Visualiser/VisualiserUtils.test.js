import { limitQuery, buildExplanationQuery, computeAttributes, filterMaps, getNeighboursData } from '@/components/Visualiser/VisualiserUtils.js';
import MockConcepts from '../../../helpers/MockConcepts';

Array.prototype.flatMap = function flat(lambda) { return Array.prototype.concat.apply([], this.map(lambda)); };

jest.mock('@/components/Visualiser/RightBar/SettingsTab/DisplaySettings.js', () => ({
  getTypeLabels() { return []; },
}));

jest.mock('@/components/shared/PersistentStorage', () => ({
  get() { return 10; },
}));

describe('limit Query', () => {
  test('add offset and limit to query', () => {
    const query = 'match $x isa person; get;';
    const limited = limitQuery(query);
    expect(limited).toBe('match $x isa person; get; offset 0; limit 10;');
  });
  test('add offset to query already containing limit', () => {
    const query = 'match $x isa person; get; limit 40;';
    const limited = limitQuery(query);
    expect(limited).toBe('match $x isa person; get; limit 40; offset 0;');
  });
  test('add limit to query already containing offset', () => {
    const query = 'match $x isa person; get; offset 20;';
    const limited = limitQuery(query);
    expect(limited).toBe('match $x isa person; get; offset 20; limit 10;');
  });
  test('query already containing offset and limit does not get changed', () => {
    const query = 'match $x isa person; get; offset 0; limit 40;';
    const limited = limitQuery(query);
    expect(limited).toBe(query);
  });
  test('query already containing offset and limit in inverted order does not get changed', () => {
    const query = 'match $x isa person; get; limit 40; offset 0;';
    const limited = limitQuery(query);
    expect(limited).toBe(query);
  });
  test('query containing multi-line queries', () => {
    const query = `
    match $x isa person;
    $r($x, $y); get;`;
    const limited = limitQuery(query);
    expect(limited).toBe(`
    match $x isa person;
    $r($x, $y); get; offset 0; limit 10;`);
  });
  test('query containing multi-line get query', () => {
    const query = `
    match $x isa person;
    get    
         $x;`;
    const limited = limitQuery(query);
    expect(limited).toBe(`
    match $x isa person;
    get    
         $x; offset 0; limit 10;`);
  });
  test('query without get', () => {
    const query = 'match $x isa person;';
    const limited = limitQuery(query);
    expect(limited).toBe('match $x isa person;');
  });
});

describe('Compute Attributes', () => {
  test('attach attributes to type', async () => {
    const nodes = await computeAttributes([MockConcepts.getMockEntityType()]);
    expect(nodes[0].attributes[0].type).toBe('name');
  });
  test('attach attributes to thing', async () => {
    const nodes = await computeAttributes([MockConcepts.getMockEntity1()]);
    expect(nodes[0].attributes[0].type).toBe('name');
    expect(nodes[0].attributes[0].value).toBe('John');
  });
});

describe('Build Explanation Query', () => {
  test('from two entities', async () => {
    const explanationQuery = buildExplanationQuery(MockConcepts.getMockAnswer1(), MockConcepts.getMockQueryPattern1);
    expect(explanationQuery.query).toBe('match $p id 3333; $c1 id 4444; ');
    expect(explanationQuery.attributeQuery).toBe(null);
  });
  test('from entity and attribute', async () => {
    const explanationQuery = buildExplanationQuery(MockConcepts.getMockAnswer2(), MockConcepts.getMockQueryPattern2);
    expect(explanationQuery.query).toBe('match $c id 3333; ');
    expect(explanationQuery.attributeQuery).toBe('has gender $1234;');
  });
  test('from entity and relation', async () => {
    const explanationQuery = buildExplanationQuery(MockConcepts.getMockAnswer3(), MockConcepts.getMockQueryPattern3);
    expect(explanationQuery.query).toBe('match $p id 3333; $c id 4444; ');
    expect(explanationQuery.attributeQuery).toBe(null);
  });
  test('from attribute and relation', async () => {
    const explanationQuery = buildExplanationQuery(MockConcepts.getMockAnswer4(), MockConcepts.getMockQueryPattern4);
    expect(explanationQuery.query).toBe('match ');
    expect(explanationQuery.attributeQuery).toBe('$5678 id 6666 has duration $1234;');
  });
});

describe('Filters out Answers that contain inferred concepts in their ConceptMap', () => {
  test('contains implicit type', async () => {
    const containsImplicit = await filterMaps([MockConcepts.getMockAnswerContainingImplicitType(), MockConcepts.getMockAnswer1()]);
    expect(containsImplicit).toHaveLength(1);
  });
  test('does not contains implicit type', async () => {
    const containsImplicit = await filterMaps([MockConcepts.getMockAnswer1(), MockConcepts.getMockAnswer2()]);
    expect(containsImplicit).toHaveLength(2);
  });
});

describe('Get neighbours data', () => {
  test('type', async () => {
    const mockGraknTx = {
      query: () => Promise.resolve({ collect: () => Promise.resolve([MockConcepts.getMockAnswerContainingEntity()]) }),
    };
    const neighboursData = await getNeighboursData(MockConcepts.getMockEntityType(), mockGraknTx, 1);

    expect(neighboursData.nodes).toHaveLength(1);
    expect(neighboursData.edges).toHaveLength(1);
    expect(JSON.stringify(neighboursData.nodes[0])).toBe('{"baseType":"ENTITY","id":"3333","offset":0,"graqlVar":"x"}');
    expect(JSON.stringify(neighboursData.edges[0])).toBe('{"from":"3333","to":"0000","label":"isa"}');
  });
  test('entity', async () => {
    const mockGraknTx = {
      query: () => Promise.resolve({ collect: () => Promise.resolve([MockConcepts.getMockAnswerContainingRelation()]) }),
    };
    const neighboursData = await getNeighboursData(MockConcepts.getMockEntity1(), mockGraknTx, 1);

    expect(neighboursData.nodes).toHaveLength(2);
    expect(neighboursData.edges).toHaveLength(2);
    expect(JSON.stringify(neighboursData.nodes[0])).toBe('{"baseType":"RELATION","id":"6666","explanation":{},"offset":0,"graqlVar":"r"}');
    expect(JSON.stringify(neighboursData.nodes[1])).toBe('{"baseType":"ENTITY","id":"4444","explanation":{},"graqlVar":"r"}');
    expect(JSON.stringify(neighboursData.edges[0])).toBe('{"from":"6666","to":"3333","label":"son"}');
    expect(JSON.stringify(neighboursData.edges[1])).toBe('{"from":"6666","to":"4444","label":"father"}');
  });
  test('attribute', async () => {
    const mockGraknTx = {
      query: () => Promise.resolve({ collect: () => Promise.resolve([MockConcepts.getMockAnswerContainingEntity()]) }),
    };
    const neighboursData = await getNeighboursData(MockConcepts.getMockAttribute(), mockGraknTx, 1);

    expect(neighboursData.nodes).toHaveLength(1);
    expect(neighboursData.edges).toHaveLength(1);
    expect(JSON.stringify(neighboursData.nodes[0])).toBe('{"baseType":"ENTITY","id":"3333","offset":0,"graqlVar":"x"}');
    expect(JSON.stringify(neighboursData.edges[0])).toBe('{"from":"3333","to":"5555","label":"has"}');
  });
  test('relation', async () => {
    const mockGraknTx = {
      query: () => Promise.resolve({ collect: () => Promise.resolve([MockConcepts.getMockAnswerContainingEntity()]) }),
      getConcept: () => Promise.resolve((MockConcepts.getMockRelation())),
    };
    const neighboursData = await getNeighboursData(MockConcepts.getMockRelation(), mockGraknTx, 1);

    expect(neighboursData.nodes).toHaveLength(1);
    expect(neighboursData.edges).toHaveLength(1);
    expect(JSON.stringify(neighboursData.nodes[0])).toBe('{"baseType":"ENTITY","id":"3333","offset":0,"graqlVar":"x"}');
    expect(JSON.stringify(neighboursData.edges[0])).toBe('{"from":"6666","to":"3333","label":"son"}');
  });
});
