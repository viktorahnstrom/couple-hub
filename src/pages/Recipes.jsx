import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useHousehold } from '../contexts/HouseholdContext'

const MEALDB = 'https://www.themealdb.com/api/json/v1/1'

async function searchByIngredient(ingredient) {
  try {
    const res = await fetch(`${MEALDB}/filter.php?i=${encodeURIComponent(ingredient)}`)
    const data = await res.json()
    return (data.meals || []).map(m => ({ id: m.idMeal, name: m.strMeal, thumb: m.strMealThumb }))
  } catch {
    return []
  }
}

async function fetchMealDetail(id) {
  try {
    const res = await fetch(`${MEALDB}/lookup.php?i=${id}`)
    const data = await res.json()
    return data.meals?.[0] || null
  } catch {
    return null
  }
}

function getMealIngredients(meal) {
  const list = []
  for (let i = 1; i <= 20; i++) {
    const ing = meal[`strIngredient${i}`]?.trim()
    const meas = meal[`strMeasure${i}`]?.trim()
    if (ing) list.push({ ingredient: ing, measure: meas || '' })
  }
  return list
}

export default function Recipes() {
  const navigate = useNavigate()
  const { household } = useHousehold()

  const [ingredients, setIngredients] = useState([])   // food staples in stock
  const [recipes, setRecipes]         = useState([])   // scored recipe list
  const [searching, setSearching]     = useState(false)
  const [detail, setDetail]           = useState(null) // full meal data
  const [detailLoading, setDetailLoading] = useState(false)
  const [searched, setSearched]       = useState(false)

  useEffect(() => {
    if (!household) return
    loadIngredients()
  }, [household])

  async function loadIngredients() {
    const { data } = await supabase
      .from('home_staples')
      .select('name, status, category')
      .eq('household_id', household.id)
      .eq('category', 'mat')
      .in('status', ['ok', 'bought'])
    setIngredients(data || [])
  }

  async function findRecipes() {
    if (ingredients.length === 0) return
    setSearching(true)
    setSearched(true)

    // Search with up to 6 ingredients to keep it fast
    const searchList = ingredients.slice(0, 6).map(i => i.name)

    const results = await Promise.all(searchList.map(searchByIngredient))

    // Score each meal by how many ingredient searches returned it
    const scoreMap = {}
    const nameMap  = {}
    const thumbMap = {}

    results.forEach((meals, idx) => {
      meals.forEach(meal => {
        scoreMap[meal.id]  = (scoreMap[meal.id] || 0) + 1
        nameMap[meal.id]   = meal.name
        thumbMap[meal.id]  = meal.thumb
      })
    })

    const scored = Object.entries(scoreMap)
      .map(([id, score]) => ({ id, name: nameMap[id], thumb: thumbMap[id], score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)

    setRecipes(scored)
    setSearching(false)
  }

  async function openDetail(meal) {
    setDetailLoading(true)
    setDetail({ loading: true, name: meal.name, thumb: meal.thumb })
    const full = await fetchMealDetail(meal.id)
    setDetail(full ? { ...full, _loaded: true } : null)
    setDetailLoading(false)
  }

  const myIngredientNames = ingredients.map(i => i.name.toLowerCase())

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-5 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/more')}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-xl"
          >
            ‹
          </button>
          <h1 className="text-xl font-semibold text-gray-900">Recept</h1>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Ingredients in stock */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Ingredienser hemma ({ingredients.length})
          </p>

          {ingredients.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-gray-400 text-sm mb-1">Inga matvåror markerade som "Hemma"</p>
              <p className="text-gray-300 text-xs">
                Gå till Inköp → Hemma, lägg till mat och sätt status till Hemma eller Nyköpt
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {ingredients.map((ing, i) => (
                  <span
                    key={i}
                    className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-medium"
                  >
                    {ing.name}
                  </span>
                ))}
              </div>
              <button
                onClick={findRecipes}
                disabled={searching}
                className="w-full bg-primary-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-primary-700 active:scale-95 transition-all disabled:opacity-60"
              >
                {searching ? 'Söker recept...' : '🍳 Hitta recept'}
              </button>
            </>
          )}
        </div>

        {/* Results */}
        {searching && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {searched && !searching && recipes.length === 0 && (
          <div className="text-center py-8">
            <p className="text-3xl mb-2">🤷</p>
            <p className="text-gray-400 text-sm">Inga recept hittades med dessa ingredienser</p>
          </div>
        )}

        {recipes.length > 0 && !searching && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">
              Matförslag ({recipes.length})
            </p>
            <div className="grid grid-cols-2 gap-3">
              {recipes.map(meal => (
                <button
                  key={meal.id}
                  onClick={() => openDetail(meal)}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden text-left active:scale-95 transition-transform"
                >
                  <img
                    src={meal.thumb + '/preview'}
                    alt={meal.name}
                    className="w-full h-28 object-cover"
                  />
                  <div className="p-3">
                    <p className="text-xs font-semibold text-gray-900 leading-snug line-clamp-2">
                      {meal.name}
                    </p>
                    <p className="text-[10px] text-primary-500 font-medium mt-1">
                      {meal.score} ingrediens{meal.score !== 1 ? 'er' : ''} hemma
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recipe detail modal */}
      {detail && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end z-[60]"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-white w-full max-w-md mx-auto rounded-t-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Meal image */}
            <div className="relative">
              <img
                src={(detail.strMealThumb || detail.thumb) + (detail._loaded ? '' : '/preview')}
                alt={detail.strMeal || detail.name}
                className="w-full h-48 object-cover"
              />
              <button
                onClick={() => setDetail(null)}
                className="absolute top-3 right-3 w-8 h-8 bg-black/40 text-white rounded-full flex items-center justify-center text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                {detail.strMeal || detail.name}
              </h2>
              {detail.strCategory && (
                <p className="text-xs text-gray-400 mb-4">{detail.strCategory} · {detail.strArea || ''}</p>
              )}

              {detailLoading || !detail._loaded ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* Ingredients */}
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Ingredienser
                  </p>
                  <div className="bg-gray-50 rounded-xl p-3 mb-4">
                    {getMealIngredients(detail).map((item, i) => {
                      const have = myIngredientNames.some(n =>
                        item.ingredient.toLowerCase().includes(n) || n.includes(item.ingredient.toLowerCase())
                      )
                      return (
                        <div key={i} className={`flex items-center justify-between py-1 ${
                          i < getMealIngredients(detail).length - 1 ? 'border-b border-gray-100' : ''
                        }`}>
                          <span className={`text-sm ${have ? 'text-green-700 font-medium' : 'text-gray-700'}`}>
                            {have ? '✓ ' : ''}{item.ingredient}
                          </span>
                          <span className="text-xs text-gray-400">{item.measure}</span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Instructions */}
                  {detail.strInstructions && (
                    <>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Tillagning
                      </p>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                        {detail.strInstructions}
                      </p>
                    </>
                  )}

                  {detail.strYoutube && (
                    <a
                      href={detail.strYoutube}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 flex items-center justify-center gap-2 w-full bg-red-50 text-red-600 rounded-xl py-3 text-sm font-medium"
                    >
                      ▶ Se video på YouTube
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
