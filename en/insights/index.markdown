---
layout: default
title: Insights
permalink: /en/insights/
---

<div class="container mx-auto px-8 md:px-24 lg:px-48">
  <h1 class="text-4xl font-bold tracking-tight mb-6 mt-12">Insights</h1>
  <p class="mb-8 text-lg text-gray-600">Explore our technical articles and guides organized by topic</p>

  {% assign insights = site.pages | where_exp: "p", "p.url contains '/en/insights/' and p.url != '/en/insights/'" %}
  
  <!-- Group insights by their parent directory (topic) -->
  {% assign shell_posts = insights | where_exp: "p", "p.url contains '/shell/'" %}
  {% assign python_posts = insights | where_exp: "p", "p.url contains '/python/'" %}
  {% assign vector_db_posts = insights | where_exp: "p", "p.url contains '/vector-database/'" %}
  {% assign iot_posts = insights | where_exp: "p", "p.url contains '/iot/'" %}
  {% assign ai_posts = insights | where_exp: "p", "p.url contains '/ai/'" %}
  {% assign seo_posts = insights | where_exp: "p", "p.url contains '/seo-web/'" %}
  
  <!-- Topics Grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
    
    <!-- Shell Topic Card -->
    {% if shell_posts.size > 0 %}
    <div class="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 border border-gray-200">
      <div class="p-6">
        <div class="flex items-center mb-4">
          <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
          </div>
          <h2 class="text-xl font-bold text-gray-900">Shell & Terminal</h2>
        </div>
        <p class="text-gray-600 mb-4">Configuration guides and best practices for shell environments</p>
        <div class="space-y-2">
          {% for post in shell_posts limit:3 %}
          <a href="{{ post.url }}" class="block text-blue-600 hover:text-blue-800 hover:underline text-sm">
            → {{ post.title }}
          </a>
          {% endfor %}
        </div>
        {% if shell_posts.size > 3 %}
        <p class="mt-3 text-sm text-gray-500">
          +{{ shell_posts.size | minus: 3 }} more articles
        </p>
        {% endif %}
      </div>
    </div>
    {% endif %}
    
    <!-- Python Topic Card -->
    {% if python_posts.size > 0 %}
    <div class="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 border border-gray-200">
      <div class="p-6">
        <div class="flex items-center mb-4">
          <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-3">
            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
            </svg>
          </div>
          <h2 class="text-xl font-bold text-gray-900">Python Development</h2>
        </div>
        <p class="text-gray-600 mb-4">Python environment management and development tools</p>
        <div class="space-y-2">
          {% for post in python_posts limit:3 %}
          <a href="{{ post.url }}" class="block text-blue-600 hover:text-blue-800 hover:underline text-sm">
            → {{ post.title }}
          </a>
          {% endfor %}
        </div>
        {% if python_posts.size > 3 %}
        <p class="mt-3 text-sm text-gray-500">
          +{{ python_posts.size | minus: 3 }} more articles
        </p>
        {% endif %}
      </div>
    </div>
    {% endif %}
    
    <!-- Vector Database Topic Card -->
    {% if vector_db_posts.size > 0 %}
    <div class="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 border border-gray-200">
      <div class="p-6">
        <div class="flex items-center mb-4">
          <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
            <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"></path>
            </svg>
          </div>
          <h2 class="text-xl font-bold text-gray-900">Vector Databases</h2>
        </div>
        <p class="text-gray-600 mb-4">AI and machine learning database technologies</p>
        <div class="space-y-2">
          {% for post in vector_db_posts limit:3 %}
          <a href="{{ post.url }}" class="block text-blue-600 hover:text-blue-800 hover:underline text-sm">
            → {{ post.title }}
          </a>
          {% endfor %}
        </div>
        {% if vector_db_posts.size > 3 %}
        <p class="mt-3 text-sm text-gray-500">
          +{{ vector_db_posts.size | minus: 3 }} more articles
        </p>
        {% endif %}
      </div>
    </div>
    {% endif %}
    
    <!-- IoT & Security Topic Card -->
    {% if iot_posts.size > 0 %}
    <div class="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 border border-gray-200">
      <div class="p-6">
        <div class="flex items-center mb-4">
          <div class="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
            <svg class="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
            </svg>
          </div>
          <h2 class="text-xl font-bold text-gray-900">IoT & Security</h2>
        </div>
        <p class="text-gray-600 mb-4">IoT device security, cryptography, and embedded systems</p>
        <div class="space-y-2">
          {% for post in iot_posts limit:3 %}
          <a href="{{ post.url }}" class="block text-blue-600 hover:text-blue-800 hover:underline text-sm">
            → {{ post.title }}
          </a>
          {% endfor %}
        </div>
        {% if iot_posts.size > 3 %}
        <p class="mt-3 text-sm text-gray-500">
          +{{ iot_posts.size | minus: 3 }} more articles
        </p>
        {% endif %}
      </div>
    </div>
    {% endif %}
    
    <!-- AI & Machine Learning Card -->
    {% if ai_posts.size > 0 %}
    <div class="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 border border-gray-200">
      <div class="p-6">
        <div class="flex items-center mb-4">
          <div class="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mr-3">
            <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
            </svg>
          </div>
          <h2 class="text-xl font-bold text-gray-900">AI & Machine Learning</h2>
        </div>
        <p class="text-gray-600 mb-4">Advanced AI integration and development guides</p>
        <div class="space-y-2">
          {% for post in ai_posts limit:3 %}
          <a href="{{ post.url }}" class="block text-blue-600 hover:text-blue-800 hover:underline text-sm">
            → {{ post.title }}
          </a>
          {% endfor %}
        </div>
        {% if ai_posts.size > 3 %}
        <p class="mt-3 text-sm text-gray-500">
          +{{ ai_posts.size | minus: 3 }} more articles
        </p>
        {% endif %}
      </div>
    </div>
    {% else %}
    <!-- AI & Machine Learning (Coming Soon) -->
    <div class="bg-gray-50 rounded-lg shadow-md border border-gray-200 opacity-75">
      <div class="p-6">
        <div class="flex items-center mb-4">
          <div class="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mr-3">
            <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
            </svg>
          </div>
          <h2 class="text-xl font-bold text-gray-700">AI & Machine Learning</h2>
        </div>
        <p class="text-gray-500 mb-4">Advanced AI integration and development guides</p>
        <p class="text-sm text-gray-400 italic">Coming soon...</p>
      </div>
    </div>
    {% endif %}
    
    <!-- SEO & Web Optimization Card -->
    {% if seo_posts.size > 0 %}
    <div class="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 border border-gray-200">
      <div class="p-6">
        <div class="flex items-center mb-4">
          <div class="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mr-3">
            <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>
          <h2 class="text-xl font-bold text-gray-900">SEO & Web Optimization</h2>
        </div>
        <p class="text-gray-600 mb-4">Modern SEO strategies and web performance</p>
        <div class="space-y-2">
          {% for post in seo_posts limit:3 %}
          <a href="{{ post.url }}" class="block text-blue-600 hover:text-blue-800 hover:underline text-sm">
            → {{ post.title }}
          </a>
          {% endfor %}
        </div>
        {% if seo_posts.size > 3 %}
        <p class="mt-3 text-sm text-gray-500">
          +{{ seo_posts.size | minus: 3 }} more articles
        </p>
        {% endif %}
      </div>
    </div>
    {% else %}
    <!-- SEO & Web Optimization (Coming Soon) -->
    <div class="bg-gray-50 rounded-lg shadow-md border border-gray-200 opacity-75">
      <div class="p-6">
        <div class="flex items-center mb-4">
          <div class="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mr-3">
            <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>
          <h2 class="text-xl font-bold text-gray-700">SEO & Web Optimization</h2>
        </div>
        <p class="text-gray-500 mb-4">Modern SEO strategies and web performance</p>
        <p class="text-sm text-gray-400 italic">Coming soon...</p>
      </div>
    </div>
    {% endif %}
  </div>

  <!-- Contact Section -->
  <div class="mt-16 p-6 bg-blue-50 rounded-lg border border-blue-200">
    <h2 class="text-xl font-bold mb-2">Have a topic in mind?</h2>
    <p class="text-gray-700">We're always looking for new topics to explore. Contact us at <a href="mailto:congruent.tech.ug@gmail.com" class="text-blue-600 hover:text-blue-800 hover:underline font-medium">congruent.tech.ug@gmail.com</a> with your suggestions.</p>
  </div>
</div>