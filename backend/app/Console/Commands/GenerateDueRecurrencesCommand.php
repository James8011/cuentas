<?php

namespace App\Console\Commands;

use App\Services\Phase3Service;
use Illuminate\Console\Command;

class GenerateDueRecurrencesCommand extends Command
{
    protected $signature = 'recurrences:generate-due {--date= : Fecha YYYY-MM-DD (default hoy)}';

    protected $description = 'Genera ocurrencias de plantillas recurrentes vencidas (idempotente)';

    public function handle(Phase3Service $phase3): int
    {
        $date = $this->option('date')
            ? \Carbon\CarbonImmutable::createFromFormat('Y-m-d', $this->option('date'))->startOfDay()
            : null;

        $results = $phase3->generateDueRecurrences($date);
        $ok = collect($results)->where('status', 'generated')->count();
        $skip = collect($results)->where('status', 'skipped')->count();
        $err = collect($results)->where('status', 'error')->count();

        foreach ($results as $row) {
            $this->line(sprintf(
                '[%s] template #%d hogar #%d — %s',
                $row['status'],
                $row['template_id'],
                $row['household_id'],
                $row['message'],
            ));
        }

        $this->info("Generadas: {$ok} · Omitidas: {$skip} · Errores: {$err}");

        return $err > 0 ? self::FAILURE : self::SUCCESS;
    }
}
