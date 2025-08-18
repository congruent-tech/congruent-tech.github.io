---
layout: default
title: Insights
permalink: /en/insights/
---

<div class="container mx-auto px-8 md:px-24 lg:px-48">
  <h1 class="text-4xl font-bold tracking-tight mb-6 mt-12">Insights</h1>
  <p class="mb-6">Latest thoughts ...</p>

  {% assign insights = site.pages | where_exp: "p", "p.url contains '/en/insights/' and p.url != '/en/insights/'" %}
  {% for page in insights %}
    <div class="mb-8">
      <h2 class="text-2xl font-bold">
        <a href="{{ page.url }}" class="text-blue-600 hover:underline">{{ page.title }}</a>
      </h2>
      {% if page.category %}
        <p class="text-sm text-gray-500 mb-1">Category: {{ page.category }}</p>
      {% endif %}
      {% if page.excerpt %}
        <p>{{ page.excerpt }}</p>
      {% endif %}
    </div>
  {% endfor %}

  <h2 class="text-xl font-bold mt-12">Have a topic in mind?</h2>
  <p>Contact us at <a href="mailto:congruent.tech.ug@gmail.com" class="text-blue-500 hover:underline">here</a>.</p>
</div>