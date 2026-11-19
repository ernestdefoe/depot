<?php

namespace ErnestDefoe\Depot\Api\Field;

use Flarum\Api\Context;
use Flarum\Api\Schema;

/** Whether to show the navigation link and the upload button at all, decided by the server. */
class ForumFields
{
    public function __invoke(): array
    {
        return [
            Schema\Boolean::make('canViewDepot')
                ->get(fn ($forum, Context $context) => $context->getActor()->hasPermission('depot.view')),
            Schema\Boolean::make('canUploadToDepot')
                ->get(fn ($forum, Context $context) => $context->getActor()->hasPermission('depot.upload')),
        ];
    }
}
