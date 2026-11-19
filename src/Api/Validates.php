<?php

namespace ErnestDefoe\Depot\Api;

use Flarum\Foundation\ValidationException;

/** For the controllers that take input: a translated validation error, from the controller's injected $translator. */
trait Validates
{
    protected function fail(string $field, string $key, array $params = []): never
    {
        throw new ValidationException([$field => $this->translator->trans("ernestdefoe-depot.api.$key", $params)]);
    }
}
