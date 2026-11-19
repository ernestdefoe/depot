<?php

namespace ErnestDefoe\Depot\Api\Controller;

use Carbon\Carbon;
use ErnestDefoe\Depot\Api\Concerns;
use ErnestDefoe\Depot\Api\Validates;
use ErnestDefoe\Depot\Model\Review;
use ErnestDefoe\Depot\Service\Counters;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Write or change your review of a file. One each; the author cannot review their own. */
class SaveReviewController implements RequestHandlerInterface
{
    use Concerns;
    use Validates;

    public function __construct(private Counters $counters, private TranslatorInterface $translator)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();
        $actor->assertPermission($actor->hasPermission('depot.review'));
        $file = $this->visibleFile($actor, Arr::get($request->getQueryParams(), 'id'));

        if ($file->isOwnedBy($actor) || ! $file->approved_at) {
            $this->fail('rating', 'cannot_review');
        }

        $in = $this->input($request);
        $rating = (int) Arr::get($in, 'rating');
        if ($rating < 1 || $rating > 5) {
            $this->fail('rating', 'bad_rating');
        }

        // One review per person per file: a second save replaces the first,
        // in one statement, so a double submit can't hit the unique key.
        Review::query()->upsert([[
            'file_id' => $file->id,
            'user_id' => $actor->id,
            'rating' => $rating,
            'body' => mb_substr(trim((string) Arr::get($in, 'body', '')), 0, 5000) ?: null,
            'version_id' => $file->latest_version_id,
            'created_at' => Carbon::now(),
            'updated_at' => Carbon::now(),
        ]], ['file_id', 'user_id'], ['rating', 'body', 'version_id', 'updated_at']);
        $review = Review::query()->where('file_id', $file->id)->where('user_id', $actor->id)->firstOrFail();

        $this->counters->file($file);

        return new JsonResponse(['id' => $review->id], 200);
    }
}
