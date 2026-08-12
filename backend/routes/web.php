<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    $frontend = env('FRONTEND_URL', 'http://127.0.0.1:5173');

    return redirect()->away($frontend);
});
