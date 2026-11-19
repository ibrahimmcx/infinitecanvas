import { describe, expect, it } from 'vitest';
import { validateImportedJson } from '@/shared/utils/validation';

describe('JSON import validation', () => {
  it('rejects empty or malformed JSON', () => {
    expect(validateImportedJson('').valid).toBe(false);
    expect(validateImportedJson('{bad json').valid).toBe(false);
    expect(validateImportedJson('[]').valid).toBe(false);
  });

  it('imports a valid single-canvas export and remaps IDs safely', () => {
    const payload = JSON.stringify({
      app: 'Infinite Canvas',
      version: 1,
      canvas: {
        id: 'canvas_old',
        name: 'Design Systems',
        description: 'Curated references',
        nodes: [
          {
            id: 'n1',
            position: { x: 100, y: 200 },
            data: {
              title: 'Linear',
              url: 'https://linear.app',
              tags: ['ui', 'saas'],
              color: 'indigo',
            },
          },
          {
            id: 'n2',
            position: { x: 450, y: 200 },
            data: {
              title: 'Raycast',
              url: 'https://raycast.com',
              tags: ['tools'],
              color: 'emerald',
            },
          },
        ],
        edges: [
          {
            id: 'e1',
            source: 'n1',
            target: 'n2',
            data: { label: 'Similar craft', animated: true },
          },
        ],
      },
    });

    const result = validateImportedJson(payload);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.canvases).toHaveLength(1);

    const imported = result.canvases[0]!;
    expect(imported.id).not.toBe('canvas_old');
    expect(imported.name).toBe('Design Systems');
    expect(imported.nodes).toHaveLength(2);
    expect(imported.edges).toHaveLength(1);
    expect(imported.edges[0]!.source).toBe(imported.nodes[0]!.id);
    expect(imported.edges[0]!.target).toBe(imported.nodes[1]!.id);
    expect(imported.edges[0]!.data?.label).toBe('Similar craft');
  });

  it('strips malicious javascript: nodes and orphaned edges with warnings', () => {
    const payload = JSON.stringify({
      name: 'Mixed Safety Test',
      nodes: [
        {
          id: 'safe',
          position: { x: 0, y: 0 },
          data: { title: 'Safe', url: 'https://example.com' },
        },
        {
          id: 'xss',
          position: { x: 200, y: 0 },
          data: { title: 'Bad', url: 'javascript:alert(1)' },
        },
      ],
      edges: [{ id: 'e1', source: 'safe', target: 'xss' }],
    });

    const result = validateImportedJson(payload);
    expect(result.valid).toBe(true);
    expect(result.canvases[0]!.nodes).toHaveLength(1);
    expect(result.canvases[0]!.edges).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThanOrEqual(2);
  });
});
