<?php

namespace Tests\Unit;

use App\Support\PhoneNormalizer;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class PhoneNormalizerTest extends TestCase
{
    #[Test]
    public function it_normalizes_colombian_mobile_without_country_code(): void
    {
        $this->assertSame('+573001112233', PhoneNormalizer::normalize('3001112233'));
        $this->assertSame('+573001112233', PhoneNormalizer::normalize('300 111 2233'));
    }

    #[Test]
    public function it_accepts_international_e164(): void
    {
        $this->assertSame('+12025550123', PhoneNormalizer::normalize('+1 202 555 0123'));
    }

    #[Test]
    public function it_rejects_invalid_numbers(): void
    {
        $this->expectException(InvalidArgumentException::class);
        PhoneNormalizer::normalize('123');
    }
}
