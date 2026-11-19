<?php

namespace ErnestDefoe\Depot\Tests\integration;

use Psr\Http\Message\ResponseInterface;

/**
 * Depot's JSON:API, read back into the shapes the pages use: a list's files
 * as cards with the list's meta beside them, a file's page as one array.
 */
trait DepotApi
{
    /** @return array<string, mixed> */
    protected function decode(ResponseInterface $response): array
    {
        return json_decode((string) $response->getBody(), true) ?? [];
    }

    /** One resource object as a flat array: its attributes and its id. */
    protected function flatten(array $resource): array
    {
        return ['id' => (int) $resource['id']] + ($resource['attributes'] ?? []);
    }

    /**
     * The downloads list. $query takes the old names: category, q, compat,
     * filter (mine|watching|queue), sort (updated|downloads|rating|newest), page.
     */
    protected function browse(?int $as = null, array $query = []): array
    {
        $params = ['filter' => [], 'page' => ['offset' => 24 * (int) ($query['page'] ?? 0)]];
        foreach (['category', 'q', 'compat'] as $key) {
            if (($query[$key] ?? '') !== '') {
                $params['filter'][$key] = $query[$key];
            }
        }
        if (! empty($query['filter'])) {
            $params['filter'][$query['filter']] = '1';
        }
        $sorts = ['downloads' => '-downloadCount', 'rating' => '-rating', 'newest' => '-createdAt'];
        if (isset($sorts[$query['sort'] ?? ''])) {
            $params['sort'] = $sorts[$query['sort']];
        }

        $response = $this->send($this->request('GET', '/api/depot-files', $as ? ['authenticatedAs' => $as] : [])->withQueryParams($params));
        $this->assertSame(200, $response->getStatusCode(), substr((string) $response->getBody(), 0, 400));
        $body = $this->decode($response);

        return ['files' => array_map(fn ($r) => $this->flatten($r), $body['data']), 'hasMore' => isset($body['links']['next'])] + ($body['meta'] ?? []);
    }

    /** A file's page, by slug or number, with the categories beside it. */
    protected function page(?int $as, string|int $file): array
    {
        $response = $this->send($this->request('GET', "/api/depot-files/$file", $as ? ['authenticatedAs' => $as] : []));
        $this->assertSame(200, $response->getStatusCode(), substr((string) $response->getBody(), 0, 400));
        $body = $this->decode($response);

        return $this->flatten($body['data']) + ($body['meta'] ?? []);
    }

    /** PATCH a resource's attributes; the status code comes back. */
    protected function patch(int $as, string $type, int $id, array $attributes): int
    {
        return $this->send($this->request('PATCH', "/api/$type/$id", [
            'authenticatedAs' => $as,
            'json' => ['data' => ['type' => $type, 'id' => (string) $id, 'attributes' => $attributes]],
        ]))->getStatusCode();
    }

    protected function remove(int $as, string $type, int $id): int
    {
        return $this->send($this->request('DELETE', "/api/$type/$id", ['authenticatedAs' => $as]))->getStatusCode();
    }

    /** Write a review of a file (a second one changes the first). */
    protected function review(int $as, int $file, int $rating, ?string $body = null): int
    {
        return $this->send($this->request('POST', '/api/depot-reviews', [
            'authenticatedAs' => $as,
            'json' => ['data' => ['type' => 'depot-reviews', 'attributes' => ['fileId' => $file, 'rating' => $rating, 'body' => $body]]],
        ]))->getStatusCode();
    }
}
